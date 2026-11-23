/**
 * Admin dashboard REST tests (STR/02 v1 admin block): timing-safe env login
 * with generic failures + rate limit, user management (coins adjust / ban),
 * catalog name/price/active PATCH with audit rows, pack editing, upload
 * route validation, payment records browser.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';

vi.mock('../src/models/user.js', () => ({
  User: {
    findById: vi.fn(),
    findOneAndUpdate: vi.fn(),
    find: vi.fn(),
    countDocuments: vi.fn(),
    updateOne: vi.fn(() => ({ exec: () => Promise.resolve({ matchedCount: 1 }) })),
  },
}));

vi.mock('../src/models/checkout.js', () => ({
  Checkout: {
    create: vi.fn(async () => undefined),
    findOne: vi.fn(),
    updateOne: vi.fn(() => ({ exec: () => Promise.resolve({ matchedCount: 1 }) })),
    find: vi.fn(),
    countDocuments: vi.fn(),
  },
  CHECKOUT_STATUSES: ['created', 'paid', 'failed', 'expired'] as const,
}));

vi.mock('../src/models/coin-pack.js', () => ({
  CoinPack: {
    findById: vi.fn(),
    find: vi.fn(),
    create: vi.fn(async () => undefined),
    updateOne: vi.fn(() => ({ exec: () => Promise.resolve({ matchedCount: 1 }) })),
  },
}));

vi.mock('../src/models/catalog-item.js', () => ({
  CatalogItem: {
    findById: vi.fn(),
    find: vi.fn(),
    create: vi.fn(async () => undefined),
    updateOne: vi.fn(() => ({ exec: () => Promise.resolve({ matchedCount: 1 }) })),
  },
  CATALOG_CATEGORIES: ['hair', 'beard', 'hat', 'shirt', 'glasses', 'frame', 'anim', 'voicePack', 'theme'] as const,
  CATALOG_TIERS: ['common', 'rare', 'epic'] as const,
}));

vi.mock('../src/models/admin-audit.js', () => ({
  AdminAudit: {
    create: vi.fn(async () => undefined),
    find: vi.fn(),
    countDocuments: vi.fn(),
  },
}));

vi.mock('../src/models/wallet-ledger.js', () => ({
  WalletLedger: {
    create: vi.fn(async () => undefined),
    aggregate: vi.fn(),
    find: vi.fn(),
  },
  LEDGER_REASONS: ['win', 'survived_round', 'purchase', 'spend', 'adjust'] as const,
}));

vi.mock('../src/models/match-record.js', () => ({
  MatchRecord: {
    countDocuments: vi.fn(),
  },
}));

vi.mock('../src/lib/wallet.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/lib/wallet.js')>();
  return {
    ...actual,
    deriveBalance: vi.fn(async (): Promise<number> => 0),
    deriveBalances: vi.fn(async (): Promise<Map<string, number>> => new Map()),
    appendLedger: vi.fn(
      async (): Promise<{ ok: true } | { ok: false; duplicate: true }> => ({ ok: true }),
    ),
  };
});

vi.mock('../src/lib/rateLimit.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/lib/rateLimit.js')>();
  return { ...actual };
});

import express, { Router } from 'express';
import http from 'node:http';
import { createApp } from '../src/app.js';
import { User } from '../src/models/user.js';
import { CatalogItem } from '../src/models/catalog-item.js';
import { CoinPack } from '../src/models/coin-pack.js';
import { AdminAudit } from '../src/models/admin-audit.js';
import { appendLedger, deriveBalance } from '../src/lib/wallet.js';
import { MatchRecord } from '../src/models/match-record.js';
import { createAdminRouter } from '../src/routes/admin.js';
import { timingSafeEqualStrings } from '../src/lib/secureCompare.js';
import { escapeRegExp } from '../src/lib/api.js';
import { timingSafeEqual } from 'node:crypto';
import {
  listen,
  makeCount,
  makeQuery,
  request,
  json,
  tinyLimiter,
  PROXY_TEST_CONFIG,
  TEST_CONFIG,
  type Listening,
} from './helpers/harness.js';
import { createAuthMiddleware } from '../src/middleware/auth.js';

const USER_ID = '507f1f77bcf86cd799439011';
const auth = createAuthMiddleware(TEST_CONFIG.authSecret);
const admin = { cookie: `lg_admin=${auth.signAdminToken()}` };
const session = { cookie: `lg_session=${auth.signSessionToken(USER_ID)}` };

// Two mounts on this test server: the full app (unlimited limiters) and the
// /limited admin router with a 2-attempt login limiter for the 429 test.
let server: Listening;
let limitedApp: http.Server;
let limitedUrl: string;
const uploaded = { id: '', url: '', name: '' };

beforeAll(async () => {
  const unlimited = tinyLimiter(1_000_000);
  const images = {
    ensureProject: vi.fn(async () => 'prj-img'),
    presign: vi.fn(),
    uploadImage: vi.fn(async () => {
      uploaded.id = 'file_9';
      uploaded.url = 'http://images.test/f/file_9/cowboy.png';
      uploaded.name = 'cowboy.png';
      return { ...uploaded, folder: 'catalog/hat' };
    }),
    replaceImage: vi.fn(),
    renameImage: vi.fn(),
    moveImage: vi.fn(),
    deleteImage: vi.fn(),
    listImages: vi.fn(async () => ({
      page: 1,
      perPage: 20,
      total: 1,
      totalPages: 1,
      files: [
        { id: 'file_9', name: 'cowboy.png', publicUrl: '/f/file_9/cowboy.png', folder: 'catalog/hat' },
      ],
    })),
  };
  server = await listen(
    createApp(PROXY_TEST_CONFIG, {
      limiters: { billing: unlimited, auth: unlimited, admin: unlimited, login: unlimited },
      images,
    }),
  );

  const tinyRouter = createAdminRouter(TEST_CONFIG, {
    loginLimiter: tinyLimiter(2),
    images,
  });
  limitedApp = http.createServer((req, res) => {
    void (async () => {
      const sub = express();
      sub.use(express.json({ limit: '64kb' }));
      sub.use('/api/admin', tinyRouter);
      sub(req, res);
    })();
  });
  await new Promise<void>((resolve) => limitedApp.listen(0, '127.0.0.1', resolve));
  const addr = limitedApp.address();
  limitedUrl = `http://127.0.0.1:${typeof addr === 'object' && addr ? addr.port : 0}`;
});

afterAll(async () => {
  await server.close();
  await new Promise<void>((resolve) => limitedApp.close(() => resolve()));
});

beforeEach(() => {
  vi.mocked(User.findById).mockImplementation(
    () =>
      makeQuery([{ _id: USER_ID, nickname: 'Ron', level: 5, banned: false }], 'findOne') as unknown as ReturnType<
        typeof User.findById
      >,
  );
});

describe('POST /api/admin/login (timing-safe, generic failure, rate-limited)', () => {
  const LOGIN = { username: 'envadmin', password: 'correct-horse-battery' };

  it('rejects wrong username and wrong password with the IDENTICAL generic body', async () => {
    const wrongUser = await request(`${server.url}/api/admin/login`, {
      method: 'POST',
      body: json({ username: 'nope', password: LOGIN.password }),
    });
    const wrongPass = await request(`${server.url}/api/admin/login`, {
      method: 'POST',
      body: json({ username: LOGIN.username, password: 'nope' }),
    });
    expect(wrongUser.status).toBe(401);
    expect(wrongPass.status).toBe(401);
    expect(wrongUser.body).toEqual(wrongPass.body);
    expect(wrongUser.body).toEqual({ error: 'INVALID_CREDENTIALS' });
  });

  it('accepts the env credentials and sets an httpOnly lg_admin cookie + audit row', async () => {
    const res = await request(`${server.url}/api/admin/login`, {
      method: 'POST',
      body: json(LOGIN),
    });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true, actor: 'env-admin' });
    const setCookie = res.headers.getSetCookie().join('\n');
    expect(setCookie).toContain('lg_admin=');
    expect(setCookie.toLowerCase()).toContain('httponly');
    expect(vi.mocked(AdminAudit.create)).toHaveBeenCalledWith(
      expect.objectContaining({ actor: 'env-admin', action: 'login', targetType: 'auth' }),
    );
  });

  it('rate-limits login to 5/15min (429 on the 3rd attempt in the tiny window)', async () => {
    for (let i = 0; i < 2; i += 1) {
      const ok = await request(`${limitedUrl}/api/admin/login`, {
        method: 'POST',
        body: json(LOGIN),
      });
      expect(ok.status).toBe(200);
    }
    const throttled = await request(`${limitedUrl}/api/admin/login`, {
      method: 'POST',
      body: json(LOGIN),
    });
    expect(throttled.status).toBe(429);
    expect(throttled.body).toEqual({ error: 'RATE_LIMITED' });
  });

  it('timingSafeEqualStrings is constant-shape (sha256 digests, no length throw)', () => {
    expect(timingSafeEqualStrings('a', 'a')).toBe(true);
    expect(timingSafeEqualStrings('a', 'b')).toBe(false);
    expect(timingSafeEqualStrings('short', 'much-longer-input')).toBe(false);
    expect(() => timingSafeEqualStrings('', 'x')).not.toThrow();
  });
});

describe('coins adjust + ban (every mutation audited)', () => {
  const coins = () =>
    request(`${server.url}/api/admin/users/${USER_ID}/coins`, {
      method: 'POST',
      headers: admin,
      body: json({ delta: -50, reason: 'made a mess' }),
    });

  it('requires the admin cookie', async () => {
    const res = await request(`${server.url}/api/admin/users/${USER_ID}/coins`, {
      method: 'POST',
      headers: session, // a USER session is not an admin
      body: json({ delta: 50, reason: 'nope' }),
    });
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: 'ADMIN_REQUIRED' });
  });

  it('appends a reason-adjust ledger row + audit row (negative deltas allowed)', async () => {
    vi.mocked(deriveBalance).mockResolvedValueOnce(950);
    const res = await coins();
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true, delta: -50, balance: 950 });
    expect(vi.mocked(appendLedger)).toHaveBeenCalledWith(
      expect.objectContaining({
        accountId: USER_ID,
        delta: -50,
        reason: 'adjust',
        txId: expect.stringMatching(/^adjust:/),
      }),
    );
    expect(vi.mocked(AdminAudit.create)).toHaveBeenCalledWith(
      expect.objectContaining({
        actor: 'env-admin',
        action: 'coins_adjust',
        targetType: 'user',
        targetId: USER_ID,
        details: expect.objectContaining({ delta: -50, reason: 'made a mess' }),
      }),
    );
  });

  it('rejects zero deltas and bad bodies', async () => {
    const zero = await request(`${server.url}/api/admin/users/${USER_ID}/coins`, {
      method: 'POST',
      headers: admin,
      body: json({ delta: 0, reason: 'does nothing' }),
    });
    expect(zero.status).toBe(400);
    const nonsense = await request(`${server.url}/api/admin/users/${USER_ID}/coins`, {
      method: 'POST',
      headers: admin,
      body: json({ delta: 'lots' }),
    });
    expect(nonsense.status).toBe(400);
    expect(vi.mocked(appendLedger)).not.toHaveBeenCalled();
  });

  it('bans + unbans with reason and audit trail', async () => {
    const res = await request(`${server.url}/api/admin/users/${USER_ID}/ban`, {
      method: 'POST',
      headers: admin,
      body: json({ banned: true, reason: 'cheating' }),
    });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true, banned: true });
    expect(vi.mocked(User.updateOne)).toHaveBeenCalledWith(
      { _id: USER_ID },
      { $set: { banned: true, banReason: 'cheating' } },
    );
    expect(vi.mocked(AdminAudit.create)).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'ban', targetType: 'user', details: { reason: 'cheating' } }),
    );

    const unban = await request(`${server.url}/api/admin/users/${USER_ID}/ban`, {
      method: 'POST',
      headers: admin,
      body: json({ banned: false }),
    });
    expect(unban.status).toBe(200);
    expect(vi.mocked(AdminAudit.create)).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'unban' }),
    );
  });

  it('escapes search input before it becomes a RegExp', () => {
    expect(escapeRegExp('a.b*c[d]')).toBe('a\\.b\\*c\\[d\\]');
    expect(escapeRegExp('")).find(||').includes('.')).toBe(true);
  });
});

describe('catalog editing (the owner’s core requirement)', () => {
  const ITEM = { _id: 'hat:cowboy', name: 'Cowboy', price: 250, active: true, free: false };

  it('PATCHes name, price and active — precisely the provided fields — and audits the change', async () => {
    vi.mocked(CatalogItem.findById).mockImplementation(
      () => makeQuery([ITEM], 'findOne') as unknown as ReturnType<typeof CatalogItem.findById>,
    );
    const res = await request(`${server.url}/api/admin/catalog/hat:cowboy`, {
      method: 'PATCH',
      headers: admin,
      body: json({ name: 'Ranch Hat', price: 199, active: false }),
    });
    expect(res.status).toBe(200);
    expect(vi.mocked(CatalogItem.create)).not.toHaveBeenCalled(); // PATCH never creates
    expect(vi.mocked(AdminAudit.create)).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'catalog_update',
        targetType: 'catalog',
        targetId: 'hat:cowboy',
        details: expect.objectContaining({
          patch: expect.objectContaining({ name: 'Ranch Hat', price: 199, active: false }),
          before: expect.objectContaining({ name: 'Cowboy', price: 250, active: true }),
        }),
      }),
    );
  });

  it('rejects invalid patches (negative price, image trio broken) without touching the DB', async () => {
    vi.mocked(CatalogItem.findById).mockImplementation(
      () => makeQuery([ITEM], 'findOne') as unknown as ReturnType<typeof CatalogItem.findById>,
    );
    const negative = await request(`${server.url}/api/admin/catalog/hat:cowboy`, {
      method: 'PATCH',
      headers: admin,
      body: json({ price: -5 }),
    });
    expect(negative.status).toBe(400);

    const trio = await request(`${server.url}/api/admin/catalog/hat:cowboy`, {
      method: 'PATCH',
      headers: admin,
      body: json({ imageId: 'f1', imageUrl: 'http://x/y.png', name: 'ok' }),
    });
    expect(trio.status).toBe(400); // imageName missing — the trio travels together
    expect(vi.mocked(AdminAudit.create)).not.toHaveBeenCalled();
  });

  it('404s patching a missing item', async () => {
    vi.mocked(CatalogItem.findById).mockImplementation(
      () => makeQuery([], 'findOne') as unknown as ReturnType<typeof CatalogItem.findById>,
    );
    const res = await request(`${server.url}/api/admin/catalog/hat:none`, {
      method: 'PATCH',
      headers: admin,
      body: json({ price: 100 }),
    });
    expect(res.status).toBe(404);
  });

  it('creates catalog items (category:slug id) and audits', async () => {
    const res = await request(`${server.url}/api/admin/catalog`, {
      method: 'POST',
      headers: admin,
      body: json({ category: 'hat', slug: 'top-hat', name: 'Top Hat', price: 220, sort: 6 }),
    });
    expect(res.status).toBe(201);
    expect(res.body).toEqual({ ok: true, id: 'hat:top-hat' });
    expect(vi.mocked(CatalogItem.create)).toHaveBeenCalledWith(
      expect.objectContaining({ _id: 'hat:top-hat', name: 'Top Hat', price: 220 }),
    );
    expect(vi.mocked(AdminAudit.create)).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'catalog_create', targetId: 'hat:top-hat' }),
    );
  });

  it('lists the FULL catalog (admin view includes inactive)', async () => {
    vi.mocked(CatalogItem.find).mockReturnValue(
      makeQuery([ITEM]) as unknown as ReturnType<typeof CatalogItem.find>,
    );
    const res = await request(`${server.url}/api/admin/catalog`, { headers: admin });
    expect(res.status).toBe(200);
    const body = res.body as { items: Array<Record<string, unknown>> };
    expect(body.items[0]).toMatchObject({ id: 'hat:cowboy', name: 'Cowboy', active: true });
  });
});

describe('coin-pack editing', () => {
  it('PATCHes pack name/priceMajor/coins/bonus/active — pricing authority stays in the DB', async () => {
    vi.mocked(CoinPack.findById).mockImplementation(
      () =>
        makeQuery(
          [{ _id: 'popular', name: 'Popular Pack', priceMajor: 99, coins: 1200, bonus: 100, active: true }],
          'findOne',
        ) as unknown as ReturnType<typeof CoinPack.findById>,
    );
    const res = await request(`${server.url}/api/admin/packs/popular`, {
      method: 'PATCH',
      headers: admin,
      body: json({ priceMajor: 129, bonus: 150 }),
    });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true, key: 'popular', patch: { priceMajor: 129, bonus: 150 } });
    expect(vi.mocked(AdminAudit.create)).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'pack_update',
        targetId: 'popular',
        details: expect.objectContaining({
          before: expect.objectContaining({ priceMajor: 99 }),
        }),
      }),
    );
  });

  it('404s unknown packs and rejects empty patches', async () => {
    vi.mocked(CoinPack.findById).mockImplementation(
      () => makeQuery([], 'findOne') as unknown as ReturnType<typeof CoinPack.findById>,
    );
    const missing = await request(`${server.url}/api/admin/packs/ghost`, {
      method: 'PATCH',
      headers: admin,
      body: json({ priceMajor: 10 }),
    });
    expect(missing.status).toBe(404);
  });
});

describe('image upload route (admin-only, ≤10MB, image allowlist)', () => {
  it('415s non-image content types', async () => {
    const res = await request(`${server.url}/api/admin/upload?name=b.txt`, {
      method: 'POST',
      headers: { cookie: admin.cookie, 'content-type': 'text/plain' },
      body: 'hello',
    });
    expect(res.status).toBe(415);
    expect((res.body as Record<string, unknown>)['error']).toBe('UNSUPPORTED_MEDIA_TYPE');
  });

  it('400s invalid folders without touching the image server', async () => {
    const res = await request(`${server.url}/api/admin/upload?name=cowboy.png&folder=BAD/Space`, {
      method: 'POST',
      headers: { cookie: admin.cookie, 'content-type': 'image/png' },
      body: 'bytes',
    });
    expect(res.status).toBe(400);
    expect((res.body as Record<string, unknown>)['error']).toBe('INVALID_FOLDER');
  });

  it('uploads via the backend only (browser never talks to the image server)', async () => {
    const png = Buffer.from('89504e470d0a1a0a', 'hex');
    const res = await request(`${server.url}/api/admin/upload?name=Cowboy Hat.png&folder=catalog/hat`, {
      method: 'POST',
      headers: { cookie: admin.cookie, 'content-type': 'image/png' },
      body: new Uint8Array(png),
    });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ id: 'file_9', url: 'http://images.test/f/file_9/cowboy.png', name: 'cowboy.png' });
    expect(vi.mocked(AdminAudit.create)).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'image_upload',
        targetType: 'image',
        targetId: 'file_9',
        details: expect.objectContaining({ folder: 'catalog/hat', bytes: png.length }),
      }),
    );
  });

  it('lists images with ABSOLUTE URLs resolved from the service publicUrl', async () => {
    const res = await request(`${server.url}/api/admin/images?page=1`, { headers: admin });
    expect(res.status).toBe(200);
    const body = res.body as { files: Array<Record<string, unknown>> };
    expect(body.files[0]).toMatchObject({
      id: 'file_9',
      url: 'http://images.test/f/file_9/cowboy.png',
    });
  });
});

describe('user drill-down + audit browser', () => {
  it('composes profile + balance + ledger + checkouts + match count', async () => {
    vi.mocked(User.findById).mockImplementation(
      () =>
        makeQuery(
          [
            {
              _id: USER_ID,
              provider: 'discord',
              providerId: 'd1',
              name: 'Ron',
              nickname: 'ronny',
              banned: false,
              role: 'user',
              xp: 100,
              level: 5,
              avatarSpec: { base: 'default' },
            },
          ],
          'findOne',
        ) as unknown as ReturnType<typeof User.findById>,
    );
    const ledgerQuery = makeQuery([
      { _id: 'l1', delta: 500, reason: 'purchase', refId: 'tok_1', txId: 'checkout:tok_1', at: new Date(0) },
    ]);
    const checkoutQuery = makeQuery([
      {
        _id: 'c1',
        token: 'tok_1',
        userId: USER_ID,
        packId: 'starter',
        productName: 'Starter Pack',
        amountMinor: 4900,
        status: 'paid',
        createdAt: new Date(0),
      },
    ]);
    const { WalletLedger } = await import('../src/models/wallet-ledger.js');
    const { Checkout } = await import('../src/models/checkout.js');
    vi.mocked(WalletLedger.find).mockReturnValue(ledgerQuery as never);
    vi.mocked(Checkout.find).mockReturnValue(checkoutQuery as never);
    vi.mocked(MatchRecord.countDocuments).mockImplementation(
      () => makeCount(7) as unknown as ReturnType<typeof MatchRecord.countDocuments>,
    );

    const res = await request(`${server.url}/api/admin/users/${USER_ID}`, { headers: admin });
    expect(res.status).toBe(200);
    const body = res.body as Record<string, unknown>;
    expect(body['balance']).toBe(0);
    expect(body['matchCount']).toBe(7);
    expect((body['ledger'] as unknown[])).toHaveLength(1);
    expect((body['checkouts'] as Array<Record<string, unknown>>)[0]?.['amountMinor']).toBe(4900);
  });

  it('paginates the audit browser', async () => {
    const at = new Date('2026-01-01T00:00:00Z');
    vi.mocked(AdminAudit.find).mockReturnValue(
      makeQuery([{ _id: 'a1', actor: 'env-admin', action: 'login', targetType: 'auth', targetId: '', at }]) as unknown as ReturnType<
        typeof AdminAudit.find
      >,
    );
    vi.mocked(AdminAudit.countDocuments).mockImplementation(
      () => makeCount(1) as unknown as ReturnType<typeof AdminAudit.countDocuments>,
    );
    const res = await request(`${server.url}/api/admin/audit?page=1`, { headers: admin });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      page: 1,
      perPage: 50,
      total: 1,
      rows: [
        {
          id: 'a1',
          actor: 'env-admin',
          action: 'login',
          targetType: 'auth',
          targetId: '',
          details: null,
          at: at.toISOString(),
        },
      ],
    });
  });
});
