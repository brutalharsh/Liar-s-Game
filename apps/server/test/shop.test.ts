/**
 * Shop spend flow (STR/04 §3, STR/09): insufficient balance, idempotency,
 * free claims, level-locked items, public catalog shape, entitlements.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';

vi.mock('../src/models/user.js', () => ({
  User: {
    findById: vi.fn(),
    findOneAndUpdate: vi.fn(),
    find: vi.fn(),
    countDocuments: vi.fn(),
    updateOne: vi.fn(),
  },
}));

vi.mock('../src/models/catalog-item.js', () => ({
  CatalogItem: {
    findById: vi.fn(),
    find: vi.fn(),
    create: vi.fn(),
    updateOne: vi.fn(),
  },
  CATALOG_CATEGORIES: ['hair', 'beard', 'hat', 'shirt', 'glasses', 'frame', 'anim', 'voicePack', 'theme'] as const,
  CATALOG_TIERS: ['common', 'rare', 'epic'] as const,
}));

vi.mock('../src/models/entitlement.js', () => ({
  Entitlement: {
    findOne: vi.fn(),
    find: vi.fn(),
    create: vi.fn(async () => undefined),
  },
  ENTITLEMENT_KINDS: ['item', 'theme', 'title', 'capacity'] as const,
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

vi.mock('../src/lib/mongo-tx.js', () => ({
  withTransaction: vi.fn(
    async <T>(work: (session: undefined) => Promise<T>): Promise<T> => work(undefined),
  ),
}));

import { createApp } from '../src/app.js';
import { CatalogItem } from '../src/models/catalog-item.js';
import { Entitlement } from '../src/models/entitlement.js';
import { appendLedger, deriveBalance } from '../src/lib/wallet.js';
import { User } from '../src/models/user.js';
import { decidePurchase } from '../src/routes/shop.js';
import {
  listen,
  makeQuery,
  request,
  json,
  TEST_CONFIG,
  type Listening,
} from './helpers/harness.js';
import { createAuthMiddleware } from '../src/middleware/auth.js';

const USER_ID = '507f1f77bcf86cd799439011';
const auth = createAuthMiddleware(TEST_CONFIG.authSecret);
const session = { cookie: `lg_session=${auth.signSessionToken(USER_ID)}` };
const LEVEL_9 = { _id: USER_ID, nickname: 'Ron', level: 9, banned: false };

let server: Listening;

beforeAll(async () => {
  server = await listen(createApp(TEST_CONFIG));
});

afterAll(async () => {
  await server.close();
});

beforeEach(() => {
  vi.mocked(User.findById).mockImplementation(
    () => makeQuery([LEVEL_9], 'findOne') as unknown as ReturnType<typeof User.findById>,
  );
});

function stubItem(doc: Record<string, unknown> | null): void {
  vi.mocked(CatalogItem.findById).mockImplementation(
    () =>
      makeQuery(doc ? [doc] : [], 'findOne') as unknown as ReturnType<typeof CatalogItem.findById>,
  );
}

function stubOwned(owned: boolean): void {
  vi.mocked(Entitlement.findOne).mockImplementation(
    () =>
      makeQuery(owned ? [{ kind: 'item', key: 'mohawk' }] : [], 'findOne') as unknown as ReturnType<
        typeof Entitlement.findOne
      >,
  );
}

const MOHAWK = {
  _id: 'hair:mohawk',
  category: 'hair',
  name: 'Mohawk',
  price: 150,
  free: false,
  active: true,
  tier: 'rare',
  sort: 5,
};

describe('decidePurchase (pure decision matrix)', () => {
  const base = {
    exists: true,
    active: true,
    free: false,
    levelLocked: false,
    owned: false,
    price: 100,
    balance: 200,
  };

  it('404s missing or inactive items', () => {
    expect(decidePurchase({ ...base, exists: false }).action).toBe('error');
    const inactive = decidePurchase({ ...base, active: false });
    expect(inactive).toMatchObject({ action: 'error', status: 404 });
  });

  it('treats owned items as idempotent no-ops', () => {
    expect(decidePurchase({ ...base, owned: true }).action).toBe('idempotent');
  });

  it('refuses level-locked items (earned-only)', () => {
    const locked = decidePurchase({ ...base, levelLocked: true });
    expect(locked).toMatchObject({ action: 'error', status: 422, error: 'ITEM_LEVEL_LOCKED' });
  });

  it('claims free items without a ledger row', () => {
    expect(decidePurchase({ ...base, free: true }).action).toBe('claim');
    expect(decidePurchase({ ...base, price: 0 }).action).toBe('claim');
  });

  it('402s when the derived balance is short', () => {
    const broke = decidePurchase({ ...base, balance: 99 });
    expect(broke).toMatchObject({ action: 'error', status: 402, error: 'INSUFFICIENT_COINS' });
    expect(broke.action === 'error' && broke.extra).toEqual({ balance: 99, price: 100 });
  });

  it('buys when balance covers the price', () => {
    expect(decidePurchase({ ...base }).action).toBe('buy');
    expect(decidePurchase({ ...base, balance: 100 }).action).toBe('buy');
  });
});

describe('POST /api/shop/purchase', () => {
  it('requires a session', async () => {
    const res = await request(`${server.url}/api/shop/purchase`, {
      method: 'POST',
      body: json({ itemId: 'hair:mohawk' }),
    });
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: 'AUTH_REQUIRED' });
  });

  it('404s for unknown or inactive items', async () => {
    stubItem(null);
    const res = await request(`${server.url}/api/shop/purchase`, {
      method: 'POST',
      headers: session,
      body: json({ itemId: 'hair:none' }),
    });
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'ITEM_NOT_FOUND' });
  });

  it('402 INSUFFICIENT_COINS — no ledger append, no entitlement', async () => {
    stubItem(MOHAWK);
    stubOwned(false);
    vi.mocked(deriveBalance).mockResolvedValueOnce(100);
    const res = await request(`${server.url}/api/shop/purchase`, {
      method: 'POST',
      headers: session,
      body: json({ itemId: 'hair:mohawk' }),
    });
    expect(res.status).toBe(402);
    expect(res.body).toEqual({ error: 'INSUFFICIENT_COINS', balance: 100, price: 150 });
    expect(vi.mocked(appendLedger)).not.toHaveBeenCalled();
    expect(vi.mocked(Entitlement.create)).not.toHaveBeenCalled();
  });

  it('buys: ledger append with mission-exact txId + entitlement insert', async () => {
    stubItem(MOHAWK);
    stubOwned(false);
    vi.mocked(deriveBalance).mockResolvedValue(300);
    const res = await request(`${server.url}/api/shop/purchase`, {
      method: 'POST',
      headers: session,
      body: json({ itemId: 'hair:mohawk' }),
    });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true, status: 'purchased', itemId: 'hair:mohawk', balance: 150 });
    expect(vi.mocked(appendLedger)).toHaveBeenCalledWith(
      expect.objectContaining({
        accountId: USER_ID,
        delta: -150,
        reason: 'spend',
        refId: 'hair:mohawk',
        txId: `spend:${USER_ID}:hair:mohawk`,
      }),
      undefined,
    );
    expect(vi.mocked(Entitlement.create)).toHaveBeenCalled();
  });

  it('double-click is idempotent: already-owned → no second charge', async () => {
    stubItem(MOHAWK);
    stubOwned(true);
    vi.mocked(deriveBalance).mockResolvedValueOnce(150);
    const res = await request(`${server.url}/api/shop/purchase`, {
      method: 'POST',
      headers: session,
      body: json({ itemId: 'hair:mohawk' }),
    });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true, status: 'already_owned', itemId: 'hair:mohawk', balance: 150 });
    expect(vi.mocked(appendLedger)).not.toHaveBeenCalled();
    expect(vi.mocked(Entitlement.create)).not.toHaveBeenCalled();
  });

  it('a racing duplicate spend (txId collision) collapses to already_owned', async () => {
    stubItem(MOHAWK);
    stubOwned(false);
    vi.mocked(deriveBalance).mockResolvedValue(300);
    vi.mocked(appendLedger).mockResolvedValueOnce({ ok: false, duplicate: true });
    const res = await request(`${server.url}/api/shop/purchase`, {
      method: 'POST',
      headers: session,
      body: json({ itemId: 'hair:mohawk' }),
    });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true, status: 'already_owned', itemId: 'hair:mohawk', balance: 300 });
    expect(vi.mocked(Entitlement.create)).not.toHaveBeenCalled();
  });

  it('claims free items with a free-entitlement and no ledger row', async () => {
    stubItem({ ...MOHAWK, _id: 'hair:short', price: 0, free: true });
    stubOwned(false);
    vi.mocked(deriveBalance).mockResolvedValueOnce(500);
    const res = await request(`${server.url}/api/shop/purchase`, {
      method: 'POST',
      headers: session,
      body: json({ itemId: 'hair:short' }),
    });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true, status: 'claimed', itemId: 'hair:short', balance: 500 });
    expect(vi.mocked(appendLedger)).not.toHaveBeenCalled();
    expect(vi.mocked(Entitlement.create)).toHaveBeenCalledWith({
      accountId: USER_ID,
      kind: 'item',
      key: 'short',
      source: 'free',
    });
  });

  it('422s level-locked prestige items for everyone (earned-only)', async () => {
    stubItem({ ...MOHAWK, _id: 'frame:prestige-gold', levelReq: 30, price: 400 });
    stubOwned(false);
    const res = await request(`${server.url}/api/shop/purchase`, {
      method: 'POST',
      headers: session,
      body: json({ itemId: 'frame:prestige-gold' }),
    });
    expect(res.status).toBe(422);
    expect(res.body).toEqual({ error: 'ITEM_LEVEL_LOCKED' });
    expect(vi.mocked(appendLedger)).not.toHaveBeenCalled();
  });

  it('maps themes to kind theme with the slug key', async () => {
    stubItem({ _id: 'theme:neon-district', category: 'theme', name: 'Neon District', price: 400, free: false, active: true });
    stubOwned(false);
    vi.mocked(deriveBalance).mockResolvedValue(1000);
    const res = await request(`${server.url}/api/shop/purchase`, {
      method: 'POST',
      headers: session,
      body: json({ itemId: 'theme:neon-district' }),
    });
    expect(res.status).toBe(200);
    expect(vi.mocked(Entitlement.create)).toHaveBeenCalledWith(
      [
        expect.objectContaining({
          accountId: USER_ID,
          kind: 'theme',
          key: 'neon-district',
          source: 'purchase',
        }),
      ],
      undefined,
    );
  });

  it('in-balance re-derivation inside the transaction still guards overspend', async () => {
    stubItem(MOHAWK);
    stubOwned(false);
    // Pre-check passes with 300, the in-transaction derivation sees 100.
    vi.mocked(deriveBalance)
      .mockResolvedValueOnce(300)
      .mockResolvedValueOnce(100);
    const res = await request(`${server.url}/api/shop/purchase`, {
      method: 'POST',
      headers: session,
      body: json({ itemId: 'hair:mohawk' }),
    });
    expect(res.status).toBe(402);
    expect(res.body).toEqual({ error: 'INSUFFICIENT_COINS', balance: 100, price: 150 });
    expect(vi.mocked(appendLedger)).not.toHaveBeenCalled();
  });
});

describe('GET /api/catalog + /api/me/entitlements', () => {
  it('lists ONLY active items publicly, cacheable', async () => {
    vi.mocked(CatalogItem.find).mockReturnValue(
      makeQuery([
        {
          _id: 'hair:mohawk',
          category: 'hair',
          name: 'Mohawk',
          price: 150,
          free: false,
          tier: 'rare',
          levelReq: null,
          imageUrl: null,
          sort: 5,
          theme: null,
        },
      ]) as unknown as ReturnType<typeof CatalogItem.find>,
    );
    const res = await request(`${server.url}/api/catalog`);
    expect(res.status).toBe(200);
    expect(vi.mocked(CatalogItem.find)).toHaveBeenCalledWith({ active: true });
    const body = res.body as { items: Array<Record<string, unknown>> };
    expect(body.items).toHaveLength(1);
    expect(body.items[0]).toMatchObject({ id: 'hair:mohawk', price: 150, tier: 'rare' });
    expect(res.headers.get('cache-control')).toContain('max-age=60');
  });

  it('entitlements requires a session and returns rows', async () => {
    const anon = await request(`${server.url}/api/me/entitlements`);
    expect(anon.status).toBe(401);

    vi.mocked(Entitlement.find).mockReturnValue(
      makeQuery([{ kind: 'item', key: 'mohawk', source: 'purchase', at: new Date(0) }]) as unknown as ReturnType<
        typeof Entitlement.find
      >,
    );
    const res = await request(`${server.url}/api/me/entitlements`, { headers: session });
    expect(res.status).toBe(200);
    const body = res.body as { entitlements: Array<Record<string, unknown>> };
    expect(body.entitlements[0]).toMatchObject({ kind: 'item', key: 'mohawk', source: 'purchase' });
  });
});
