/**
 * /api/me — self-service profile mutations (T3, 2026-11-23; STR/08 §7/§13).
 *
 *   PUT  /api/me/profile   { nickname }            — sanitize + persist (audit)
 *   POST /api/me/equip     { slot, itemId }        — merge into user.avatarSpec
 *
 * Equip contract (the settings-editor wave builds against this):
 *   - slot ∈ hair | beard | hat | shirt | glasses | base (strict enum; the
 *     frame/anim/voicePack slots are NOT attachable this wave — 400).
 *   - itemId null on an attachable slot UNEQUIPS it (idempotent no-op when
 *     the slot was empty; never needs ownership).
 *   - itemId must be the FULL catalog id (`hair:mohawk`, `body:dog`):
 *     looked up in catalog_items (active), its category must equal `slot`
 *     (else 400 ITEM_SLOT_MISMATCH), and the caller must own it via
 *     entitlements (kind 'item', key = slug after the first ':') — else
 *     403 EQUIPMENT_NOT_OWNED. Free catalog items must be CLAIMED once in
 *     the shop, exactly like purchased ones.
 *   - slot 'base': itemId = a canonical AVATAR_BASE_IDS slug. The two
 *     human-*-thin bases are FREE to equip for every account; every other
 *     base requires the matching owned `body:<slug>` catalog item.
 *     itemId null on 'base' is rejected (a base cannot be unequipped).
 *   - merge semantics: a flat $set of user.avatarSpec — the changed slot
 *     (or base) replaced, every other key (including legacy slugs) rides
 *     through untouched; keys never become `undefined`.
 *
 * Ban guard: requireAuth re-reads the user row on every request (403 BANNED).
 * Both mutations are rate-limited (30/min by default; tests inject their own).
 */
import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import type { AppConfig } from '@liars-game/shared/server';
import {
  AVATAR_BASE_IDS,
  AvatarAttachableSlotSchema,
  sanitizeNickname,
} from '@liars-game/shared';
import type { RateLimitRequestHandler } from 'express-rate-limit';
import rateLimit from 'express-rate-limit';
import { jsonError, parseBody } from '../lib/api.js';
import { writeAudit } from '../lib/audit.js';
import { createAuthMiddleware, type AuthMiddleware } from '../middleware/auth.js';
import { CatalogItem } from '../models/catalog-item.js';
import { Entitlement } from '../models/entitlement.js';
import { User, type UserAvatarSpec } from '../models/user.js';

const AVATAR_SLOTS = AvatarAttachableSlotSchema.options;
type EquipSlot = (typeof AVATAR_SLOTS)[number] | 'base';

const EquipBody = z.strictObject({
  slot: z.enum([...AVATAR_SLOTS, 'base'] as const),
  itemId: z.string().min(1).max(80).nullable(),
});

const ProfileBody = z.strictObject({
  nickname: z.string().min(1).max(18),
});

/** Bases any account may equip with no catalog item at all. */
const FREE_BASES: readonly string[] = AVATAR_BASE_IDS.filter(
  (id) => id.startsWith('human-') && id.endsWith('-thin'),
);

export interface MeRouterDeps {
  meLimiter?: RateLimitRequestHandler;
  /** Injected so tests can assert writes without a Mongo mock escape hatch. */
  audit?: typeof writeAudit;
}

/**
 * Pure merge (unit-tested): returns the NEXT flat spec. Untouched keys ride
 * through verbatim; `undefined` never lands in the stored document.
 */
export function mergeAvatarSpec(
  current: UserAvatarSpec | null | undefined,
  slot: EquipSlot,
  itemId: string | null,
): UserAvatarSpec {
  const next: UserAvatarSpec = { ...(current ?? { base: 'human-male-thin' }) };
  for (const key of Object.keys(next) as (keyof UserAvatarSpec)[]) {
    if (next[key] === undefined) delete next[key];
  }
  if (slot === 'base') {
    if (itemId === null) return next; // guarded earlier — never reached
    next.base = itemId;
    return next;
  }
  if (itemId === null) {
    delete next[slot];
    return next;
  }
  next[slot] = itemId;
  return next;
}

export function createMeRouter(config: AppConfig, deps: MeRouterDeps = {}): Router {
  const router = Router();
  const auth: AuthMiddleware = createAuthMiddleware(config.authSecret);
  const limiter: RateLimitRequestHandler[] = deps.meLimiter
    ? [deps.meLimiter]
    : [
        rateLimit({
          windowMs: 60 * 1000,
          limit: 30,
          standardHeaders: 'draft-8',
          legacyHeaders: false,
          message: { error: 'RATE_LIMITED' },
        }),
      ];

  // PUT /api/me/profile — nickname only (1..18 input; sanitizer is the truth)
  router.put(
    '/me/profile',
    ...limiter,
    auth.requireAuth,
    async (req: Request, res: Response): Promise<void> => {
      const body = parseBody(ProfileBody, req.body, res);
      if (!body) return;
      const user = req.user;
      if (!user) {
        jsonError(res, 401, 'AUTH_REQUIRED');
        return;
      }
      const clean = sanitizeNickname(body.nickname);
      if (clean === '') {
        jsonError(res, 422, 'NICKNAME_REJECTED');
        return;
      }
      const updated = await User.findOneAndUpdate(
        { _id: user.id },
        { $set: { nickname: clean } },
        { new: true },
      )
        .select('nickname')
        .lean()
        .exec();
      if (!updated) {
        jsonError(res, 404, 'USER_NOT_FOUND');
        return;
      }
      await (deps.audit ?? writeAudit)(user.id, {
        action: 'profile.update',
        targetType: 'user',
        targetId: user.id,
        details: { nickname: clean, previous: user.nickname },
      });
      res.json({ ok: true, nickname: (updated as { nickname?: string }).nickname ?? clean });
    },
  );

  // POST /api/me/equip — one slot change merged into user.avatarSpec
  router.post(
    '/me/equip',
    ...limiter,
    auth.requireAuth,
    async (req: Request, res: Response): Promise<void> => {
      const body = parseBody(EquipBody, req.body, res);
      if (!body) return;
      const user = req.user;
      if (!user) {
        jsonError(res, 401, 'AUTH_REQUIRED');
        return;
      }
      const { slot, itemId } = body;

      const doc = (await User.findById(user.id)
        .select('avatarSpec')
        .lean()
        .exec()) as { avatarSpec?: UserAvatarSpec } | null;
      if (!doc) {
        jsonError(res, 404, 'USER_NOT_FOUND');
        return;
      }

      // ── slot: base (canonical slugs; thin free, rest gated by body:* item)
      if (slot === 'base') {
        if (itemId === null) {
          jsonError(res, 400, 'BASE_REQUIRED');
          return;
        }
        if (!AVATAR_BASE_IDS.includes(itemId as (typeof AVATAR_BASE_IDS)[number])) {
          jsonError(res, 400, 'INVALID_BASE');
          return;
        }
        if (!FREE_BASES.includes(itemId)) {
          const item = (await CatalogItem.findById(`body:${itemId}`).lean().exec()) as {
            active?: boolean;
          } | null;
          if (!item || item.active === false) {
            jsonError(res, 404, 'ITEM_NOT_FOUND');
            return;
          }
          const owned = await Entitlement.findOne({
            accountId: user.id,
            kind: 'item',
            key: itemId,
          })
            .lean()
            .exec();
          if (!owned) {
            jsonError(res, 403, 'EQUIPMENT_NOT_OWNED');
            return;
          }
        }
        const spec = mergeAvatarSpec(doc.avatarSpec, 'base', itemId);
        await User.updateOne({ _id: user.id }, { $set: { avatarSpec: spec } }).exec();
        res.json({ ok: true, spec });
        return;
      }

      // ── attachable slots (hair | beard | hat | shirt | glasses)
      if (itemId === null) {
        const current = doc.avatarSpec;
        if (!(current && current[slot] !== undefined)) {
          // idempotent unequip of an already-empty slot — no write, echo the
          // stored spec (or the default fallback shape when none exists yet)
          res.json({ ok: true, spec: current ?? mergeAvatarSpec(current, slot, null) });
          return;
        }
        const spec = mergeAvatarSpec(current, slot, null);
        await User.updateOne({ _id: user.id }, { $set: { avatarSpec: spec } }).exec();
        res.json({ ok: true, spec });
        return;
      }

      const item = (await CatalogItem.findById(itemId).lean().exec()) as {
        _id: string;
        category?: string;
        active?: boolean;
      } | null;
      if (!item || item.active === false) {
        jsonError(res, 404, 'ITEM_NOT_FOUND');
        return;
      }
      if (item.category !== slot) {
        jsonError(res, 400, 'ITEM_SLOT_MISMATCH');
        return;
      }
      const owned = await Entitlement.findOne({
        accountId: user.id,
        kind: 'item',
        key: itemId.slice(item.category.length + 1) || itemId,
      })
        .lean()
        .exec();
      if (!owned) {
        jsonError(res, 403, 'EQUIPMENT_NOT_OWNED');
        return;
      }

      const spec = mergeAvatarSpec(doc.avatarSpec, slot, itemId);
      await User.updateOne({ _id: user.id }, { $set: { avatarSpec: spec } }).exec();
      await (deps.audit ?? writeAudit)(user.id, {
        action: 'me.equip',
        targetType: 'user',
        targetId: user.id,
        details: { slot, itemId },
      });
      res.json({ ok: true, spec });
    },
  );

  return router;
}
