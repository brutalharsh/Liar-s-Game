/**
 * /api/shop — coin spending + entitlements (STR/04 §3, STR/09).
 *
 * Prices come from the catalog_items DB row (server-validated — never the
 * request). Spend = ONE Mongo transaction: balance re-derived from the
 * ledger INSIDE the tx, spend ledger row (txId `spend:<userId>:<itemId>` —
 * double-click idempotent) + entitlement insert (unique index) commit
 * together or not at all. Purchases for the same user are serialized via a
 * tiny in-process keyed mutex (single-process v1 deploys, STR/06 §4) so
 * the derive-then-spend window can't double-spend across two different
 * items. Level-locked items are earned-only, never purchasable. Free items
 * are claimed (entitlement, no ledger row).
 */
import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import type { AppConfig } from '@liars-game/shared/server';
import type { ClientSession } from 'mongoose';
import { jsonError, parseBody } from '../lib/api.js';
import { appendLedger, deriveBalance, isDuplicateKeyError } from '../lib/wallet.js';
import { withTransaction } from '../lib/mongo-tx.js';
import { createAuthMiddleware, type AuthMiddleware } from '../middleware/auth.js';
import { CatalogItem } from '../models/catalog-item.js';
import { Entitlement } from '../models/entitlement.js';

const PurchaseBody = z.strictObject({ itemId: z.string().min(1).max(80) });

/** Typed internal failures mapped to responses at the route boundary. */
class PurchaseError extends Error {
  constructor(
    readonly kind: 'insufficient' | 'duplicate',
    readonly extra: Record<string, unknown> = {},
  ) {
    super(kind);
  }
}

/**
 * Pure purchase decision (unit-tested) — zero I/O.
 *  - not found / inactive → error 404
 *  - already owned        → idempotent no-op
 *  - level-locked         → 422 (earned via level-up, never purchasable)
 *  - free                 → claim (no ledger row)
 *  - balance < price      → error 402
 */
export function decidePurchase(input: {
  exists: boolean;
  active: boolean;
  free: boolean;
  levelLocked: boolean;
  owned: boolean;
  price: number;
  balance: number;
}):
  | { action: 'error'; status: number; error: string; extra?: Record<string, unknown> }
  | { action: 'claim' }
  | { action: 'idempotent' }
  | { action: 'buy' } {
  if (!input.exists || !input.active) return { action: 'error', status: 404, error: 'ITEM_NOT_FOUND' };
  if (input.owned) return { action: 'idempotent' };
  if (input.levelLocked) return { action: 'error', status: 422, error: 'ITEM_LEVEL_LOCKED' };
  if (input.free || input.price === 0) return { action: 'claim' };
  if (input.balance < input.price) {
    return {
      action: 'error',
      status: 402,
      error: 'INSUFFICIENT_COINS',
      extra: { balance: input.balance, price: input.price },
    };
  }
  return { action: 'buy' };
}

/** Keyed mutex — one entry per purchasing user, replaced on each purchase. */
const userLocks = new Map<string, Promise<unknown>>();

async function withUserLock<T>(userId: string, work: () => Promise<T>): Promise<T> {
  const previous = userLocks.get(userId) ?? Promise.resolve();
  const run = previous.then(work, work); // prior outcome irrelevant — serialize only
  userLocks.set(userId, run.catch(() => undefined));
  return run;
}

export function createShopRouter(config: AppConfig): Router {
  const router = Router();
  const auth: AuthMiddleware = createAuthMiddleware(config.authSecret);

  // PUBLIC — active catalog only, cacheable.
  router.get('/catalog', (_req: Request, res: Response): void => {
    void CatalogItem.find({ active: true })
      .sort({ category: 1, sort: 1 })
      .lean()
      .exec()
      .then((docs) => {
        res.set('Cache-Control', 'public, max-age=60');
        res.json({
          items: docs.map((doc) => ({
            id: doc._id,
            category: doc.category,
            name: doc.name,
            price: doc.price,
            free: doc.free === true,
            tier: doc.tier ?? 'common',
            levelReq: doc.levelReq ?? null,
            imageUrl: doc.imageUrl ?? null,
            sort: doc.sort ?? 0,
            theme: doc.theme ?? null,
          })),
        });
      });
  });

  router.post('/shop/purchase', auth.requireAuth, async (req: Request, res: Response): Promise<void> => {
    const body = parseBody(PurchaseBody, req.body, res);
    if (!body) return;
    const user = req.user;
    if (!user) {
      jsonError(res, 401, 'AUTH_REQUIRED');
      return;
    }
    const { itemId } = body;

    try {
      const responseBody = await withUserLock(user.id, (): Promise<Record<string, unknown>> =>
        (async () => {
          const item = await CatalogItem.findById(itemId).lean().exec();
          const slug = item ? itemId.slice(item.category.length + 1) || itemId : itemId;
          const kind = item?.category === 'theme' ? 'theme' : 'item';

          const owned =
            item === null
              ? false
              : (await Entitlement.findOne({ accountId: user.id, kind, key: slug }).lean().exec()) !== null;
          const balance = await deriveBalance(user.id);

          const decision = decidePurchase({
            exists: item !== null,
            active: item?.active !== false,
            free: item?.free === true,
            levelLocked: typeof item?.levelReq === 'number' && item.levelReq > 0,
            owned,
            price: item?.price ?? 0,
            balance,
          });

          if (decision.action === 'error') {
            return {
              responseStatus: decision.status,
              ...(decision.extra
                ? { error: decision.error, ...decision.extra }
                : { error: decision.error }),
            };
          }
          if (decision.action === 'idempotent') {
            return { ok: true, status: 'already_owned', itemId, balance };
          }

          if (decision.action === 'claim') {
            try {
              await Entitlement.create({ accountId: user.id, kind, key: slug, source: 'free' });
            } catch (err) {
              if (isDuplicateKeyError(err)) {
                return { ok: true, status: 'already_owned', itemId, balance };
              }
              throw err;
            }
            return { ok: true, status: 'claimed', itemId, balance };
          }

          // decision.action === 'buy'
          const price = item?.price ?? 0;
          const doBuy = async (session?: ClientSession): Promise<Record<string, unknown>> => {
            const txBalance = await deriveBalance(user.id);
            if (txBalance < price) {
              throw new PurchaseError('insufficient', { balance: txBalance, price });
            }
            const spend = await appendLedger(
              {
                accountId: user.id,
                delta: -price,
                reason: 'spend',
                refId: itemId,
                txId: `spend:${user.id}:${itemId}`,
              },
              session,
            );
            if (!spend.ok) throw new PurchaseError('duplicate');
            try {
              await Entitlement.create(
                [{ accountId: user.id, kind, key: slug, source: 'purchase' }],
                session ? { session } : undefined,
              );
            } catch (err) {
              if (isDuplicateKeyError(err)) throw new PurchaseError('duplicate');
              throw err;
            }
            return { ok: true, status: 'purchased', itemId, balance: txBalance - price };
          };
          return withTransaction((session) => doBuy(session));
        })(),
      );

      if (typeof responseBody['responseStatus'] === 'number') {
        const status: number = responseBody['responseStatus'];
        const payload: Record<string, unknown> = { ...responseBody };
        delete payload['responseStatus'];
        res.status(status).json(payload);
        return;
      }
      res.json(responseBody);
    } catch (err) {
      if (err instanceof PurchaseError) {
        if (err.kind === 'insufficient') {
          res.status(402).json({ error: 'INSUFFICIENT_COINS', ...err.extra });
          return;
        }
        const balance = await deriveBalance(user.id);
        res.json({ ok: true, status: 'already_owned', itemId, balance });
        return;
      }
      throw err;
    }
  });

  router.get('/me/entitlements', auth.requireAuth, (req: Request, res: Response): void => {
    void Entitlement.find({ accountId: req.user?.id })
      .lean()
      .exec()
      .then((rows) => {
        res.json({
          entitlements: rows.map((row) => ({
            kind: row.kind,
            key: row.key,
            source: row.source,
            at: row.at,
          })),
        });
      });
  });

  return router;
}
