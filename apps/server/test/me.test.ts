/**
 * /api/me (profile PUT + equip POST) — the settings-editor wave's contract:
 * nickname sanitizer pipeline, catalog/ownership gates for every attachable
 * slot, base rules (thin free · gym/species gated by `body:*` entitlement),
 * merge semantics (flat $set, untouched keys ride through), ban guard,
 * idempotent unequip/re-equip. Models mocked per the harness (no Mongo).
 *
 * The matrix runs against a mini app with an injected no-op limiter; two
 * smoke cases ride the REAL createApp to pin the /api mount in app.ts.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import express, { type Express } from 'express';
import cookieParser from 'cookie-parser';

vi.mock('../src/models/user.js', () => ({
  User: {
    findById: vi.fn(),
    findOneAndUpdate: vi.fn(),
    find: vi.fn(),
    countDocuments: vi.fn(),
    updateOne: vi.fn(() => ({ exec: async () => undefined })),
  },
}));

vi.mock('../src/models/catalog-item.js', () => ({
  CatalogItem: { findById: vi.fn(), find: vi.fn(), create: vi.fn(), updateOne: vi.fn() },
  CATALOG_CATEGORIES: ['hair', 'beard', 'hat', 'shirt', 'glasses', 'frame', 'anim', 'voicePack', 'theme', 'body'] as const,
  CATALOG_TIERS: ['common', 'rare', 'epic'] as const,
}));

vi.mock('../src/models/entitlement.js', () => ({
  Entitlement: { findOne: vi.fn(), find: vi.fn(), create: vi.fn(async () => undefined) },
  ENTITLEMENT_KINDS: ['item', 'theme', 'title', 'capacity'] as const,
}));

vi.mock('../src/models/admin-audit.js', () => ({
  AdminAudit: { create: vi.fn(async () => undefined) },
}));

import { createApp } from '../src/app.js';
import { createMeRouter, mergeAvatarSpec } from '../src/routes/me.js';
import { CatalogItem } from '../src/models/catalog-item.js';
import { Entitlement } from '../src/models/entitlement.js';
import { AdminAudit } from '../src/models/admin-audit.js';
import { User } from '../src/models/user.js';
import { createAuthMiddleware } from '../src/middleware/auth.js';
import {
  listen,
  makeQuery,
  request,
  json,
  TEST_CONFIG,
  tinyLimiter,
  type Listening,
} from './helpers/harness.js';

const USER_ID = '507f1f77bcf86cd799439011';
const auth = createAuthMiddleware(TEST_CONFIG.authSecret);
const session = { cookie: `lg_session=${auth.signSessionToken(USER_ID)}` };

const BASE_SPEC = { base: 'default', hat: 'hat:cowboy' };
const USER_DOC = {
  _id: USER_ID,
  nickname: 'Ron',
  email: 'ron@test',
  level: 7,
  banned: false,
  avatarSpec: { ...BASE_SPEC },
};

const MOHAWK = { _id: 'hair:mohawk', category: 'hair', name: 'Mohawk', active: true, price: 120 };
const BOWLER = { _id: 'hat:bowler', category: 'hat', name: 'Bowler', active: true, price: 150 };
const BODY_DOG = { _id: 'body:dog', category: 'body', name: 'Dog', active: true, price: 400 };
const ITEMS: Record<string, Record<string, unknown>> = {
  'hair:mohawk': MOHAWK,
  'hat:bowler': BOWLER,
  'body:dog': BODY_DOG,
  'body:human-male-gym': { _id: 'body:human-male-gym', category: 'body', name: 'Gym Build (Male)', active: true, price: 250 },
};
const OWNED_KEYS = new Set<string>(['mohawk']);

let server: Listening;
let realApp: Listening;
let audit: ReturnType<typeof vi.fn>;

function stubUser(doc: Record<string, unknown> = USER_DOC): void {
  vi.mocked(User.findById).mockImplementation(
    () => makeQuery([doc], 'findOne') as unknown as ReturnType<typeof User.findById>,
  );
}

function stubItem(id: string | null): void {
  vi.mocked(CatalogItem.findById).mockImplementation(
    () =>
      makeQuery(id && ITEMS[id] ? [ITEMS[id]!] : [], 'findOne') as unknown as ReturnType<
        typeof CatalogItem.findById
      >,
  );
}

function stubOwned(keys: readonly string[]): void {
  vi.mocked(Entitlement.findOne).mockImplementation((query: unknown) => {
    const key = (query as { key?: string })?.key ?? '';
    return makeQuery(keys.includes(key) ? [{ kind: 'item', key }] : [], 'findOne') as unknown as ReturnType<
      typeof Entitlement.findOne
    >;
  });
}

/** CatalogItem.findById dispatch: resolve by the requested id when possible. */
function stubItemById(): void {
  vi.mocked(CatalogItem.findById).mockImplementation(
    (id: unknown) =>
      makeQuery(typeof id === 'string' && ITEMS[id] ? [ITEMS[id]!] : [], 'findOne') as unknown as ReturnType<
        typeof CatalogItem.findById
      >,
  );
}

beforeAll(async () => {
  audit = vi.fn(async () => undefined);
  const app: Express = express();
  app.use(cookieParser());
  app.use(express.json({ limit: '64kb' }));
  app.use('/api', createMeRouter(TEST_CONFIG, { meLimiter: tinyLimiter(10_000), audit: audit as never }));
  server = await listen(app);
  realApp = await listen(createApp(TEST_CONFIG)); // smoke: pins the /api mount
});

afterAll(async () => {
  await server.close();
  await realApp.close();
});

beforeEach(() => {
  vi.clearAllMocks();
  stubUser();
  stubItemById();
  stubOwned([...OWNED_KEYS]);
  vi.mocked(User.findOneAndUpdate).mockImplementation(
    () =>
      makeQuery([{ nickname: 'Sanitized Nick' }], 'findOne') as unknown as ReturnType<
        typeof User.findOneAndUpdate
      >,
  );
});

// ── auth / ban guards ────────────────────────────────────────────────────────

describe('guards (401/403 before any handler runs)', () => {
  it('401 AUTH_REQUIRED without a session on both mutations', async () => {
    const put = await request(`${server.url}/api/me/profile`, {
      method: 'PUT',
      body: json({ nickname: 'Fox' }),
    });
    expect(put.status).toBe(401);
    expect(put.body).toEqual({ error: 'AUTH_REQUIRED' });

    const post = await request(`${server.url}/api/me/equip`, {
      method: 'POST',
      body: json({ slot: 'hair', itemId: 'hair:mohawk' }),
    });
    expect(post.status).toBe(401);
  });

  it('403 BANNED for banned users (guard inside requireAuth)', async () => {
    stubUser({ ...USER_DOC, banned: true });
    const put = await request(`${server.url}/api/me/profile`, {
      method: 'PUT',
      headers: session,
      body: json({ nickname: 'Fox' }),
    });
    expect(put.status).toBe(403);
    expect(put.body).toEqual({ error: 'BANNED' });

    const post = await request(`${server.url}/api/me/equip`, {
      method: 'POST',
      headers: session,
      body: json({ slot: 'base', itemId: 'human-male-thin' }),
    });
    expect(post.status).toBe(403);
  });

  it('404 USER_NOT_FOUND when the session points at a deleted row', async () => {
    vi.mocked(User.findById)
      .mockImplementationOnce(
        () => makeQuery([USER_DOC], 'findOne') as unknown as ReturnType<typeof User.findById>,
      )
      .mockImplementationOnce(
        () => makeQuery([], 'findOne') as unknown as ReturnType<typeof User.findById>,
      );
    const res = await request(`${server.url}/api/me/equip`, {
      method: 'POST',
      headers: session,
      body: json({ slot: 'hat', itemId: 'hat:bowler' }),
    });
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'USER_NOT_FOUND' });
  });
});

// ── PUT /api/me/profile ─────────────────────────────────────────────────────

describe('PUT /api/me/profile (nickname: shared sanitizer + audit)', () => {
  it('sanitizes, persists and echoes the cleaned nickname, then audits', async () => {
    const res = await request(`${server.url}/api/me/profile`, {
      method: 'PUT',
      headers: session,
      body: json({ nickname: '  Fancy   Sam 👑 ' }),
    });
    expect(res.status).toBe(200);
    expect(vi.mocked(User.findOneAndUpdate)).toHaveBeenCalledWith(
      { _id: USER_ID },
      { $set: { nickname: 'Fancy Sam 👑' } },
      { new: true },
    );
    expect(audit).toHaveBeenCalledWith(
      USER_ID,
      expect.objectContaining({ action: 'profile.update', targetType: 'user', targetId: USER_ID }),
    );
  });

  it('422 NICKNAME_REJECTED when the sanitizer blocks the name — no write', async () => {
    const res = await request(`${server.url}/api/me/profile`, {
      method: 'PUT',
      headers: session,
      body: json({ nickname: 'big fuckin liar' }),
    });
    expect(res.status).toBe(422);
    expect(res.body).toEqual({ error: 'NICKNAME_REJECTED' });
    expect(vi.mocked(User.findOneAndUpdate)).not.toHaveBeenCalled();
    expect(audit).not.toHaveBeenCalled();
  });

  it('422 on staff-impersonation squashes ("admin") too', async () => {
    const res = await request(`${server.url}/api/me/profile`, {
      method: 'PUT',
      headers: session,
      body: json({ nickname: 'Admin Ron' }),
    });
    expect(res.status).toBe(422);
  });

  it('400 BAD_REQUEST for >18 code points, empty strings and extra keys', async () => {
    for (const body of [
      { nickname: 'x'.repeat(19) },
      { nickname: '' },
      { nickname: 'Ron', extra: true },
      {},
    ]) {
      const res = await request(`${server.url}/api/me/profile`, {
        method: 'PUT',
        headers: session,
        body: json(body),
      });
      expect(res.status).toBe(400);
      expect(res.body).toEqual(expect.objectContaining({ error: 'BAD_REQUEST' }));
    }
  });
});

// ── POST /api/me/equip — attachable slots ────────────────────────────────────

describe('POST /api/me/equip (hair|beard|hat|shirt|glasses)', () => {
  it('equips an OWNED item: merges into avatarSpec, $set persists, audits', async () => {
    const res = await request(`${server.url}/api/me/equip`, {
      method: 'POST',
      headers: session,
      body: json({ slot: 'hair', itemId: 'hair:mohawk' }),
    });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true, spec: { base: 'default', hat: 'hat:cowboy', hair: 'hair:mohawk' } });
    expect(vi.mocked(User.updateOne)).toHaveBeenCalledWith(
      { _id: USER_ID },
      { $set: { avatarSpec: { base: 'default', hat: 'hat:cowboy', hair: 'hair:mohawk' } } },
    );
    expect(vi.mocked(Entitlement.findOne)).toHaveBeenCalledWith(
      expect.objectContaining({ accountId: USER_ID, kind: 'item', key: 'mohawk' }),
    );
    expect(audit).toHaveBeenCalledWith(
      USER_ID,
      expect.objectContaining({ action: 'me.equip', details: { slot: 'hair', itemId: 'hair:mohawk' } }),
    );
  });

  it('403 EQUIPMENT_NOT_OWNED for items the account lacks — no write', async () => {
    const res = await request(`${server.url}/api/me/equip`, {
      method: 'POST',
      headers: session,
      body: json({ slot: 'hat', itemId: 'hat:bowler' }),
    });
    expect(res.status).toBe(403);
    expect(res.body).toEqual({ error: 'EQUIPMENT_NOT_OWNED' });
    expect(vi.mocked(User.updateOne)).not.toHaveBeenCalled();
  });

  it('400 ITEM_SLOT_MISMATCH when the item belongs to another slot', async () => {
    const res = await request(`${server.url}/api/me/equip`, {
      method: 'POST',
      headers: session,
      body: json({ slot: 'hair', itemId: 'hat:bowler' }),
    });
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'ITEM_SLOT_MISMATCH' });
  });

  it('404 ITEM_NOT_FOUND for unknown or deactivated items', async () => {
    stubItem(null);
    const res = await request(`${server.url}/api/me/equip`, {
      method: 'POST',
      headers: session,
      body: json({ slot: 'hair', itemId: 'hair:none' }),
    });
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'ITEM_NOT_FOUND' });
  });

  it('400 BAD_REQUEST for a non-attachable/unknown slot (frame, anim, junk)', async () => {
    for (const slot of ['frame', 'anim', 'voicePack', 'base ', 'shoes']) {
      const res = await request(`${server.url}/api/me/equip`, {
        method: 'POST',
        headers: session,
        body: json({ slot, itemId: 'hair:mohawk' }),
      });
      expect(res.status).toBe(400);
      expect(res.body).toEqual(expect.objectContaining({ error: 'BAD_REQUEST' }));
    }
  });

  it('itemId null UNEQUIPS: the key leaves the spec, siblings survive', async () => {
    const res = await request(`${server.url}/api/me/equip`, {
      method: 'POST',
      headers: session,
      body: json({ slot: 'hat', itemId: null }),
    });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true, spec: { base: 'default' } });
    expect(vi.mocked(User.updateOne)).toHaveBeenCalledWith(
      { _id: USER_ID },
      { $set: { avatarSpec: { base: 'default' } } },
    );
  });

  it('unequipping an already-empty slot is an idempotent no-op (no write, no ownership read)', async () => {
    const res = await request(`${server.url}/api/me/equip`, {
      method: 'POST',
      headers: session,
      body: json({ slot: 'beard', itemId: null }),
    });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true, spec: { base: 'default', hat: 'hat:cowboy' } });
    expect(vi.mocked(User.updateOne)).not.toHaveBeenCalled();
  });

  it('re-equipping the same item is idempotent: same 200, same payload both times', async () => {
    const first = await request(`${server.url}/api/me/equip`, {
      method: 'POST',
      headers: session,
      body: json({ slot: 'hair', itemId: 'hair:mohawk' }),
    });
    const second = await request(`${server.url}/api/me/equip`, {
      method: 'POST',
      headers: session,
      body: json({ slot: 'hair', itemId: 'hair:mohawk' }),
    });
    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(second.body).toEqual(first.body);
    expect(vi.mocked(User.updateOne)).toHaveBeenCalledTimes(2);
    const [a, b] = vi.mocked(User.updateOne).mock.calls;
    expect(a).toEqual(b);
  });
});

// ── POST /api/me/equip — slot 'base' rules ───────────────────────────────────

describe("POST /api/me/equip — slot 'base' (thin free · gym/species gated)", () => {
  it('human-*-thin bases are FREE: no catalog lookup, no entitlement needed', async () => {
    for (const itemId of ['human-male-thin', 'human-female-thin']) {
      const res = await request(`${server.url}/api/me/equip`, {
        method: 'POST',
        headers: session,
        body: json({ slot: 'base', itemId }),
      });
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ ok: true, spec: { base: itemId, hat: 'hat:cowboy' } });
    }
    expect(vi.mocked(CatalogItem.findById)).not.toHaveBeenCalled();
    expect(vi.mocked(Entitlement.findOne)).not.toHaveBeenCalled();
  });

  it('gym + species bases are OWNERSHIP-gated via the body:<slug> catalog item', async () => {
    const denied = await request(`${server.url}/api/me/equip`, {
      method: 'POST',
      headers: session,
      body: json({ slot: 'base', itemId: 'human-male-gym' }),
    });
    expect(denied.status).toBe(403);
    expect(denied.body).toEqual({ error: 'EQUIPMENT_NOT_OWNED' });
    expect(vi.mocked(User.updateOne)).not.toHaveBeenCalled();

    stubOwned(['mohawk', 'human-male-gym']);
    const res = await request(`${server.url}/api/me/equip`, {
      method: 'POST',
      headers: session,
      body: json({ slot: 'base', itemId: 'human-male-gym' }),
    });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true, spec: { base: 'human-male-gym', hat: 'hat:cowboy' } });
  });

  it('equips an owned species body (dog) and persists the merge', async () => {
    stubOwned(['mohawk', 'dog']);
    const res = await request(`${server.url}/api/me/equip`, {
      method: 'POST',
      headers: session,
      body: json({ slot: 'base', itemId: 'dog' }),
    });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true, spec: { base: 'dog', hat: 'hat:cowboy' } });
    expect(vi.mocked(CatalogItem.findById)).toHaveBeenCalledWith('body:dog');
    expect(vi.mocked(User.updateOne)).toHaveBeenCalledWith(
      { _id: USER_ID },
      { $set: { avatarSpec: { base: 'dog', hat: 'hat:cowboy' } } },
    );
  });

  it('404 ITEM_NOT_FOUND when the gated body has no catalog row', async () => {
    stubItem(null); // body:human-female-gym not seeded in this stub
    const res = await request(`${server.url}/api/me/equip`, {
      method: 'POST',
      headers: session,
      body: json({ slot: 'base', itemId: 'human-female-gym' }),
    });
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'ITEM_NOT_FOUND' });
  });

  it('400 INVALID_BASE for non-canonical slugs and 400 BASE_REQUIRED for null', async () => {
    const bad = await request(`${server.url}/api/me/equip`, {
      method: 'POST',
      headers: session,
      body: json({ slot: 'base', itemId: 'alien' }),
    });
    expect(bad.status).toBe(400);
    expect(bad.body).toEqual({ error: 'INVALID_BASE' });

    const empty = await request(`${server.url}/api/me/equip`, {
      method: 'POST',
      headers: session,
      body: json({ slot: 'base', itemId: null }),
    });
    expect(empty.status).toBe(400);
    expect(empty.body).toEqual({ error: 'BASE_REQUIRED' });
  });
});

// ── pure merge semantics ─────────────────────────────────────────────────────

describe('mergeAvatarSpec (pure merge law)', () => {
  it('replaces ONE slot and rides every other key through untouched', () => {
    const current = { base: 'default', hat: 'hat:cowboy', hair: 'hair:short', glasses: 'glasses:round' };
    expect(mergeAvatarSpec(current, 'hat', 'hat:bowler')).toEqual({
      base: 'default',
      hat: 'hat:bowler',
      hair: 'hair:short',
      glasses: 'glasses:round',
    });
  });

  it('null itemId deletes the slot key (legacy slugs and siblings survive)', () => {
    expect(mergeAvatarSpec({ base: 'default', hat: 'hat:cowboy', beard: 'beard:goatee' }, 'beard', null)).toEqual({
      base: 'default',
      hat: 'hat:cowboy',
    });
  });

  it('base swap keeps slots; undefined values never reach the stored doc', () => {
    const withUndefined = { base: 'default', hair: undefined };
    expect(mergeAvatarSpec(withUndefined, 'base', 'dog')).toEqual({ base: 'dog' });
    expect('hair' in mergeAvatarSpec(withUndefined, 'base', 'dog')).toBe(false);
  });

  it('a missing current spec starts from the default base', () => {
    expect(mergeAvatarSpec(null, 'hair', 'hair:mohawk')).toEqual({
      base: 'human-male-thin',
      hair: 'hair:mohawk',
    });
    expect(mergeAvatarSpec(undefined, 'base', 'cat')).toEqual({ base: 'cat' });
  });
});

// ── mount smoke — the real app wires /api (default limiter + real audit path) ─

describe('mount smoke (createApp)', () => {
  it('PUT /api/me/profile works through the real app + writes a real audit row', async () => {
    const res = await request(`${realApp.url}/api/me/profile`, {
      method: 'PUT',
      headers: session,
      body: json({ nickname: 'Mounted Ron' }),
    });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true, nickname: 'Sanitized Nick' });
    expect(vi.mocked(AdminAudit.create)).toHaveBeenCalledWith(
      expect.objectContaining({ actor: USER_ID, action: 'profile.update' }),
    );
  });

  it('POST /api/me/equip works through the real app (thin base)', async () => {
    const res = await request(`${realApp.url}/api/me/equip`, {
      method: 'POST',
      headers: session,
      body: json({ slot: 'base', itemId: 'human-female-thin' }),
    });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true, spec: { base: 'human-female-thin', hat: 'hat:cowboy' } });
  });
});
