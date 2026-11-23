/**
 * /api/admin — dashboard REST (STR/02 v1 admin block, STR/08 §13).
 *
 * Login: env credentials via timing-safe compare, generic 401s, 5/15min
 * rate limit, 8h `lg_admin` cookie. Every subsequent route is behind
 * requireAdmin + a 30/min limiter, and EVERY mutation lands an admin_audit
 * row (actor 'env-admin').
 */
import express, { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import type { AppConfig } from '@liars-game/shared/server';
import { sanitizeDisplayName } from '@liars-game/shared';
import { randomUUID } from 'node:crypto';
import type { RateLimitRequestHandler } from 'express-rate-limit';
import { timingSafeEqualStrings } from '../lib/secureCompare.js';
import { appendLedger, deriveBalance, deriveBalances } from '../lib/wallet.js';
import { writeAudit } from '../lib/audit.js';
import { escapeRegExp, jsonError, parseBody } from '../lib/api.js';
import {
  ADMIN_ACTOR,
  ADMIN_COOKIE,
  OAUTH_STATE_COOKIE,
  cookieOptions,
  createAuthMiddleware,
  type AuthMiddleware,
} from '../middleware/auth.js';
import { User } from '../models/user.js';
import { WalletLedger } from '../models/wallet-ledger.js';
import { Checkout, CHECKOUT_STATUSES } from '../models/checkout.js';
import { CatalogItem, CATALOG_CATEGORIES, CATALOG_TIERS } from '../models/catalog-item.js';
import { CoinPack } from '../models/coin-pack.js';
import { AdminAudit } from '../models/admin-audit.js';
import { MatchRecord } from '../models/match-record.js';
import {
  createImageServerClient,
  slugifyFileName,
  validateFolder,
  type ImageClient,
  ImageServerError,
} from '../lib/imageServer.js';

export interface AdminRouterDeps {
  adminLimiter?: RateLimitRequestHandler;
  loginLimiter?: RateLimitRequestHandler;
  images?: ImageClient;
}

const USERS_PER_PAGE = 20;
const AUDIT_PER_PAGE = 50;
const LEDGER_RECENT = 50;
const CHECKOUTS_RECENT = 50;
const UPLOAD_MAX_BYTES = 10 * 1024 * 1024;

const ALLOWED_IMAGE_TYPES: ReadonlySet<string> = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/avif',
  'image/svg+xml',
]);

const LoginBody = z.strictObject({
  username: z.string().min(1).max(200),
  password: z.string().min(1).max(200),
});

const ObjectId = /^[a-f0-9]{24}$/i;
const UserIdParam = z.string().regex(ObjectId, 'must be a user id');

const ListQuery = z.object({
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  search: z.string().trim().max(120).optional(),
});

const PaymentsQuery = z.object({
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  status: z.enum(CHECKOUT_STATUSES).optional(),
});

const CoinsBody = z.strictObject({
  delta: z
    .number()
    .int()
    .refine((v) => v !== 0, 'delta must be non-zero'),
  reason: z.string().trim().min(3).max(200),
});

const BanBody = z.strictObject({
  banned: z.boolean(),
  reason: z
    .string()
    .trim()
    .max(200)
    .optional()
    .refine((v) => v === undefined || v.length >= 3, 'reason too short'),
});

const CatalogPatch = z
  .strictObject({
    name: z.string().trim().min(1).max(64),
    price: z.number().int().min(0).max(1_000_000),
    active: z.boolean(),
    tier: z.enum(CATALOG_TIERS),
    levelReq: z.number().int().min(1).max(100).nullable(),
    artSlug: z.string().trim().max(120),
    sort: z.number().int().min(0).max(10_000),
    imageId: z.string().trim().max(120),
    imageUrl: z.string().trim().max(500),
    imageName: z.string().trim().max(200),
  })
  .partial()
  .refine((v) => Object.keys(v).length > 0, 'at least one field required')
  .refine(
    (v) => {
      const hasAny = v.imageId !== undefined || v.imageUrl !== undefined || v.imageName !== undefined;
      const hasAll = v.imageId !== undefined && v.imageUrl !== undefined && v.imageName !== undefined;
      return !hasAny || hasAll; // {imageId, imageUrl, imageName} travel together (STR/08 §15)
    },
    { message: 'imageId, imageUrl and imageName must be set together' },
  );

const CatalogCreate = z
  .strictObject({
    category: z.enum(CATALOG_CATEGORIES),
    slug: z
      .string()
      .trim()
      .regex(/^[a-z0-9-]{1,40}$/, 'a-z, 0-9, dashes'),
    name: z.string().trim().min(1).max(64),
    price: z.number().int().min(0).max(1_000_000).default(0),
    free: z.boolean().default(false),
    active: z.boolean().default(true),
    tier: z.enum(CATALOG_TIERS).default('common'),
    levelReq: z.number().int().min(1).max(100).optional(),
    sort: z.number().int().min(0).max(10_000).default(0),
  })
  .refine((v) => v.slug.length > 0 && !v.slug.includes(':'), 'slug must not contain ":"');

const PackPatch = z
  .strictObject({
    name: z.string().trim().min(1).max(80),
    priceMajor: z.number().int().min(1).max(1_000_000),
    coins: z.number().int().min(1).max(1_000_000),
    bonus: z.number().int().min(0).max(1_000_000),
    active: z.boolean(),
  })
  .partial()
  .refine((v) => Object.keys(v).length > 0, 'at least one field required');

const UploadQuery = z.object({
  name: z.string().trim().max(160).optional(),
  folder: z.string().trim().max(200).optional(),
});

const ImagesQuery = z.object({
  page: z.coerce.number().int().min(1).max(10_000).default(1),
});

function mapCatalogItem(doc: {
  _id: string;
  name?: string;
  category?: string;
  price?: number;
  free?: boolean;
  active?: boolean;
  tier?: string;
  levelReq?: number;
  artSlug?: string;
  imageId?: string;
  imageUrl?: string;
  imageName?: string;
  sort?: number;
  theme?: unknown;
}): Record<string, unknown> {
  return {
    id: doc._id,
    category: doc.category,
    name: doc.name,
    price: doc.price ?? 0,
    free: doc.free === true,
    active: doc.active !== false,
    tier: doc.tier ?? 'common',
    levelReq: doc.levelReq ?? null,
    artSlug: doc.artSlug ?? null,
    imageId: doc.imageId ?? null,
    imageUrl: doc.imageUrl ?? null,
    imageName: doc.imageName ?? null,
    sort: doc.sort ?? 0,
    theme: doc.theme ?? null,
  };
}

export function createAdminRouter(config: AppConfig, deps: AdminRouterDeps = {}): Router {
  const router = Router();
  const auth: AuthMiddleware = createAuthMiddleware(config.authSecret);
  const images = deps.images ?? createImageServerClient(config.imageServer);
  const loginLimiter = deps.loginLimiter ? [deps.loginLimiter] : [];
  const adminLimiter = deps.adminLimiter ? [deps.adminLimiter] : [];

  // --- login (env credentials, timing-safe, generic failure) ---------------
  router.post('/login', ...loginLimiter, (req: Request, res: Response): void => {
    const body = LoginBody.safeParse(req.body);
    if (!body.success) {
      jsonError(res, 400, 'BAD_REQUEST');
      return;
    }
    const okUser = timingSafeEqualStrings(body.data.username, config.adminUsername);
    const okPassword = timingSafeEqualStrings(body.data.password, config.adminPassword);
    if (!okUser || !okPassword) {
      // Identical body + timing either way — no user/password oracle.
      res.status(401).json({ error: 'INVALID_CREDENTIALS' });
      return;
    }
    auth.adminCookie(res);
    void writeAudit(ADMIN_ACTOR, {
      action: 'login',
      targetType: 'auth',
      targetId: ADMIN_ACTOR,
      details: { success: true },
    });
    res.json({ ok: true, actor: ADMIN_ACTOR });
  });

  router.post('/logout', (req: Request, res: Response): void => {
    res.clearCookie(ADMIN_COOKIE, cookieOptions(1));
    res.json({ ok: true });
  });

  // --- everything below requires the admin cookie ---------------------------
  router.use(auth.requireAdmin, ...adminLimiter);

  // users list
  router.get('/users', (req: Request, res: Response): void => {
    const query = ListQuery.safeParse(req.query);
    if (!query.success) {
      jsonError(res, 400, 'VALIDATION');
      return;
    }
    const search = query.data.search && query.data.search.length > 0 ? query.data.search : null;
    const filter = search
      ? {
          $or: [
            { nickname: { $regex: escapeRegExp(search), $options: 'i' } },
            { name: { $regex: escapeRegExp(search), $options: 'i' } },
            { email: { $regex: escapeRegExp(search), $options: 'i' } },
            { providerId: { $regex: escapeRegExp(search), $options: 'i' } },
          ],
        }
      : {};
    void Promise.all([
      User.find(filter)
        .sort({ lastSeenAt: -1 })
        .skip((query.data.page - 1) * USERS_PER_PAGE)
        .limit(USERS_PER_PAGE)
        .select('provider name nickname avatarUrl email level xp banned activeTitle createdAt lastSeenAt')
        .lean()
        .exec(),
      User.countDocuments(filter).exec(),
    ]).then(([docs, total]) => {
      const ids = docs.map((doc) => String(doc._id));
      void deriveBalances(ids).then((balances) => {
        res.json({
          page: query.data.page,
          perPage: USERS_PER_PAGE,
          total,
          users: docs.map((doc) => ({
            id: String(doc._id),
            provider: doc.provider,
            name: doc.name,
            nickname: doc.nickname,
            avatarUrl: doc.avatarUrl ?? null,
            email: doc.email ?? null,
            level: doc.level,
            xp: doc.xp,
            banned: doc.banned,
            activeTitle: doc.activeTitle ?? null,
            balance: balances.get(String(doc._id)) ?? 0,
            createdAt: doc.createdAt,
            lastSeenAt: doc.lastSeenAt,
          })),
        });
      });
    });
  });

  // user drill-down
  router.get('/users/:id', (req: Request, res: Response): void => {
    const id = UserIdParam.safeParse(req.params['id']);
    if (!id.success) {
      jsonError(res, 400, 'BAD_REQUEST');
      return;
    }
    void Promise.all([
      User.findById(id.data).lean().exec(),
      WalletLedger.find({ accountId: id.data })
        .sort({ at: -1 })
        .limit(LEDGER_RECENT)
        .lean()
        .exec(),
      Checkout.find({ userId: id.data })
        .sort({ createdAt: -1 })
        .limit(CHECKOUTS_RECENT)
        .lean()
        .exec(),
      MatchRecord.countDocuments({ 'players.accountId': id.data }).exec(),
      deriveBalance(id.data),
    ]).then(([user, ledger, checkouts, matches, balance]) => {
      if (!user) {
        jsonError(res, 404, 'USER_NOT_FOUND');
        return;
      }
      res.json({
        user: {
          id: String(user._id),
          provider: user.provider,
          providerId: user.providerId,
          name: user.name,
          nickname: user.nickname,
          email: user.email ?? null,
          avatarUrl: user.avatarUrl ?? null,
          avatarSpec: user.avatarSpec ?? { base: 'default' },
          activeTitle: user.activeTitle ?? null,
          xp: user.xp,
          level: user.level,
          banned: user.banned,
          banReason: user.banReason ?? null,
          role: user.role,
          createdAt: user.createdAt,
          lastSeenAt: user.lastSeenAt,
        },
        balance,
        ledger: ledger.map((row) => ({
          id: String(row._id),
          delta: row.delta,
          reason: row.reason,
          refId: row.refId,
          txId: row.txId,
          at: row.at,
        })),
        checkouts: checkouts.map(mapCheckout),
        matchCount: matches,
      });
    });
  });

  // coins adjust (append-only ledger; delta may be negative)
  router.post('/users/:id/coins', async (req: Request, res: Response): Promise<void> => {
    const id = UserIdParam.safeParse(req.params['id']);
    const body = CoinsBody.safeParse(req.body);
    if (!id.success || !body.success) {
      jsonError(res, 400, 'BAD_REQUEST');
      return;
    }
    const user = await User.findById(id.data).lean().exec();
    if (!user) {
      jsonError(res, 404, 'USER_NOT_FOUND');
      return;
    }
    const refId = randomUUID();
    const txId = `adjust:${refId}`;
    const result = await appendLedger({
      accountId: id.data,
      delta: body.data.delta,
      reason: 'adjust',
      refId,
      txId,
    });
    if (!result.ok) {
      // Astronomically unlikely (fresh UUID) — treat as a system fault.
      jsonError(res, 500, 'LEDGER_CONFLICT');
      return;
    }
    await writeAudit(ADMIN_ACTOR, {
      action: 'coins_adjust',
      targetType: 'user',
      targetId: id.data,
      details: { delta: body.data.delta, reason: body.data.reason, txId },
    });
    const balance = await deriveBalance(id.data);
    res.json({ ok: true, delta: body.data.delta, balance });
  });

  // ban / unban
  router.post('/users/:id/ban', async (req: Request, res: Response): Promise<void> => {
    const id = UserIdParam.safeParse(req.params['id']);
    const body = BanBody.safeParse(req.body);
    if (!id.success || !body.success) {
      jsonError(res, 400, 'BAD_REQUEST');
      return;
    }
    const update = await User.updateOne(
      { _id: id.data },
      {
        $set: {
          banned: body.data.banned,
          banReason: body.data.banned ? body.data.reason ?? '' : '',
        },
      },
    ).exec();
    if (update.matchedCount === 0) {
      jsonError(res, 404, 'USER_NOT_FOUND');
      return;
    }
    await writeAudit(ADMIN_ACTOR, {
      action: body.data.banned ? 'ban' : 'unban',
      targetType: 'user',
      targetId: id.data,
      details: { reason: body.data.reason ?? null },
    });
    res.json({ ok: true, banned: body.data.banned });
  });

  // payment records browser
  router.get('/payments', (req: Request, res: Response): void => {
    const query = PaymentsQuery.safeParse(req.query);
    if (!query.success) {
      jsonError(res, 400, 'VALIDATION');
      return;
    }
    const filter = query.data.status ? { status: query.data.status } : {};
    void Promise.all([
      Checkout.find(filter)
        .sort({ createdAt: -1 })
        .skip((query.data.page - 1) * USERS_PER_PAGE)
        .limit(USERS_PER_PAGE)
        .lean()
        .exec(),
      Checkout.countDocuments(filter).exec(),
    ]).then(([rows, total]) => {
      res.json({
        page: query.data.page,
        perPage: USERS_PER_PAGE,
        total,
        checkouts: rows.map(mapCheckout),
      });
    });
  });

  // catalog — the owner's dashboard editing surface
  router.get('/catalog', (req: Request, res: Response): void => {
    void CatalogItem.find()
      .sort({ category: 1, sort: 1 })
      .lean()
      .exec()
      .then((docs) => {
        res.json({ items: docs.map((doc) => mapCatalogItem(doc)) });
      });
  });

  router.post('/catalog', async (req: Request, res: Response): Promise<void> => {
    const body = CatalogCreate.safeParse(req.body);
    if (!body.success) {
      jsonError(res, 400, 'BAD_REQUEST');
      return;
    }
    const name = sanitizeDisplayName(body.data.name, { maxLength: 64 });
    if (!name) {
      jsonError(res, 400, 'INVALID_NAME');
      return;
    }
    const item = {
      _id: `${body.data.category}:${body.data.slug}`,
      category: body.data.category,
      name,
      price: body.data.price,
      free: body.data.free,
      active: body.data.active,
      tier: body.data.tier,
      levelReq: body.data.levelReq,
      sort: body.data.sort,
    };
    try {
      await CatalogItem.create(item);
    } catch (err) {
      if (err instanceof Error && err.message.includes('E11000')) {
        jsonError(res, 409, 'DUPLICATE_ITEM');
        return;
      }
      throw err;
    }
    await writeAudit(ADMIN_ACTOR, {
      action: 'catalog_create',
      targetType: 'catalog',
      targetId: item._id,
      details: { ...item, name },
    });
    res.status(201).json({ ok: true, id: item._id });
  });

  router.patch('/catalog/:id', async (req: Request, res: Response): Promise<void> => {
    const id = z.string().min(1).max(120).safeParse(req.params['id']);
    const body = CatalogPatch.safeParse(req.body);
    if (!id.success || !body.success) {
      jsonError(res, 400, 'BAD_REQUEST');
      return;
    }
    const patch: Record<string, unknown> = {};
    if (body.data.name !== undefined) {
      const name = sanitizeDisplayName(body.data.name, { maxLength: 64 });
      if (!name) {
        jsonError(res, 400, 'INVALID_NAME');
        return;
      }
      patch['name'] = name;
    }
    if (body.data.levelReq !== undefined) patch['levelReq'] = body.data.levelReq ?? undefined;
    for (const key of [
      'price',
      'active',
      'tier',
      'artSlug',
      'sort',
      'imageId',
      'imageUrl',
      'imageName',
    ] as const) {
      if (body.data[key] !== undefined) patch[key] = body.data[key];
    }
    const before = await CatalogItem.findById(id.data).lean().exec();
    if (!before) {
      jsonError(res, 404, 'ITEM_NOT_FOUND');
      return;
    }
    const result = await CatalogItem.updateOne({ _id: id.data }, { $set: patch }).exec();
    if (result.matchedCount === 0) {
      jsonError(res, 404, 'ITEM_NOT_FOUND');
      return;
    }
    await writeAudit(ADMIN_ACTOR, {
      action: 'catalog_update',
      targetType: 'catalog',
      targetId: id.data,
      details: { patch, before: { name: before.name, price: before.price, active: before.active } },
    });
    res.json({ ok: true, id: id.data, patch });
  });

  // coin packs (price lives in DB; admin-editable)
  router.get('/packs', (req: Request, res: Response): void => {
    void CoinPack.find()
      .sort({ sortOrder: 1 })
      .lean()
      .exec()
      .then((docs) => {
        res.json({
          packs: docs.map((pack) => ({
            key: pack._id,
            name: pack.name,
            priceMajor: pack.priceMajor,
            coins: pack.coins,
            bonus: pack.bonus ?? 0,
            active: pack.active,
            sortOrder: pack.sortOrder,
          })),
        });
      });
  });

  router.patch('/packs/:key', async (req: Request, res: Response): Promise<void> => {
    const key = z.string().min(1).max(40).safeParse(req.params['key']);
    const body = PackPatch.safeParse(req.body);
    if (!key.success || !body.success) {
      jsonError(res, 400, 'BAD_REQUEST');
      return;
    }
    const before = await CoinPack.findById(key.data).lean().exec();
    if (!before) {
      jsonError(res, 404, 'PACK_NOT_FOUND');
      return;
    }
    await CoinPack.updateOne({ _id: key.data }, { $set: body.data }).exec();
    await writeAudit(ADMIN_ACTOR, {
      action: 'pack_update',
      targetType: 'pack',
      targetId: key.data,
      details: {
        patch: body.data,
        before: {
          name: before.name,
          priceMajor: before.priceMajor,
          coins: before.coins,
          bonus: before.bonus,
          active: before.active,
        },
      },
    });
    res.json({ ok: true, key: key.data, patch: body.data });
  });

  // image uploads for catalog art (admin-only, ≤10MB, image allowlist)
  router.post(
    '/upload',
    express.raw({ type: (): boolean => true, limit: `${UPLOAD_MAX_BYTES}` }),
    async (req: Request, res: Response): Promise<void> => {
      const query = UploadQuery.safeParse(req.query);
      const contentType = String(req.headers['content-type'] ?? '')
        .split(';')[0]
        ?.trim()
        .toLowerCase();
      if (!query.success) {
        jsonError(res, 400, 'BAD_REQUEST');
        return;
      }
      if (!contentType || !ALLOWED_IMAGE_TYPES.has(contentType)) {
        jsonError(res, 415, 'UNSUPPORTED_MEDIA_TYPE', {
          allowed: [...ALLOWED_IMAGE_TYPES].sort(),
        });
        return;
      }
      const buffer = req.body;
      if (!Buffer.isBuffer(buffer)) {
        jsonError(res, 400, 'INVALID_BODY');
        return;
      }
      // Belt + braces — express.raw's limit already raised 413 before this.
      if (buffer.length === 0 || buffer.length > UPLOAD_MAX_BYTES) {
        jsonError(res, 413, 'PAYLOAD_TOO_LARGE');
        return;
      }
      let folder: string | undefined;
      if (query.data.folder !== undefined && query.data.folder.length > 0) {
        const validated = validateFolder(query.data.folder);
        if (!validated.ok) {
          jsonError(res, 400, 'INVALID_FOLDER', { message: validated.error });
          return;
        }
        folder = validated.value;
      }
      const name = slugifyFileName(query.data.name ?? 'upload');
      try {
        const uploaded = await images.uploadImage(buffer, name, contentType, { folder });
        await writeAudit(ADMIN_ACTOR, {
          action: 'image_upload',
          targetType: 'image',
          targetId: uploaded.id,
          details: { name: uploaded.name, folder: uploaded.folder ?? null, bytes: buffer.length },
        });
        res.json({ id: uploaded.id, url: uploaded.url, name: uploaded.name });
      } catch (err) {
        if (err instanceof ImageServerError) {
          const hint =
            err.status === 401 ? ' (check IMAGE_SERVER_KEY in env)' : '';
          console.error(`[admin/upload] image server error ${err.status}${hint}: ${err.message}`);
          jsonError(res, 502, err.status === 401 ? 'IMAGE_SERVER_AUTH' : 'IMAGE_SERVER_ERROR', {
            message: err.serviceMessage ?? null,
          });
          return;
        }
        throw err;
      }
    },
  );

  // image browser (20/page from the service, absolute URLs resolved)
  router.get('/images', async (req: Request, res: Response): Promise<void> => {
    const query = ImagesQuery.safeParse(req.query);
    if (!query.success) {
      jsonError(res, 400, 'VALIDATION');
      return;
    }
    try {
      const list = await images.listImages(query.data.page);
      const base = config.imageServer.url.replace(/\/+$/, '');
      res.json({
        page: list.page,
        perPage: list.perPage,
        total: list.total,
        totalPages: list.totalPages,
        files: list.files.map((file) => ({
          id: file.id,
          name: file.name,
          folder: file.folder ?? null,
          contentType: file.contentType ?? null,
          size: file.size ?? null,
          url: `${base}${file.publicUrl}`,
          createdAt: file.createdAt ?? null,
        })),
      });
    } catch (err) {
      if (err instanceof ImageServerError) {
        console.error(`[admin/images] image server error ${err.status}: ${err.message}`);
        jsonError(res, 502, err.status === 401 ? 'IMAGE_SERVER_AUTH' : 'IMAGE_SERVER_ERROR');
        return;
      }
      throw err;
    }
  });

  // audit trail browser
  router.get('/audit', (req: Request, res: Response): void => {
    const query = ListQuery.safeParse(req.query);
    if (!query.success) {
      jsonError(res, 400, 'VALIDATION');
      return;
    }
    void Promise.all([
      AdminAudit.find()
        .sort({ at: -1 })
        .skip((query.data.page - 1) * AUDIT_PER_PAGE)
        .limit(AUDIT_PER_PAGE)
        .lean()
        .exec(),
      AdminAudit.countDocuments({}).exec(),
    ]).then(([rows, total]) => {
      res.json({
        page: query.data.page,
        perPage: AUDIT_PER_PAGE,
        total,
        rows: rows.map((row) => ({
          id: String(row._id),
          actor: row.actor,
          action: row.action,
          targetType: row.targetType,
          targetId: row.targetId,
          details: row.details ?? null,
          at: row.at,
        })),
      });
    });
  });

  return router;
}

function mapCheckout(doc: {
  _id: unknown;
  token: string;
  userId: unknown;
  packId: string;
  productName: string;
  amountMinor: number;
  currency?: string;
  status: string;
  providerOrderId?: string;
  providerPaymentId?: string;
  paidAt?: Date;
  grantedAt?: Date;
  createdAt: Date;
}): Record<string, unknown> {
  return {
    id: String(doc._id),
    token: doc.token,
    userId: String(doc.userId),
    packId: doc.packId,
    productName: doc.productName,
    amountMinor: doc.amountMinor,
    currency: doc.currency ?? 'INR',
    status: doc.status,
    providerOrderId: doc.providerOrderId ?? null,
    providerPaymentId: doc.providerPaymentId ?? null,
    paidAt: doc.paidAt ?? null,
    grantedAt: doc.grantedAt ?? null,
    createdAt: doc.createdAt,
  };
}
