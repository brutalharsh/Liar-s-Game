/**
 * Auth middleware + session surface (STR/08 §13): 401 AUTH_REQUIRED,
 * banned 403, cookie JWT roundtrips, admin guard, socket seam.
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import type { Socket } from 'socket.io';

vi.mock('../src/models/user.js', () => ({
  User: {
    findById: vi.fn(),
    findOneAndUpdate: vi.fn(),
    find: vi.fn(),
    countDocuments: vi.fn(),
    updateOne: vi.fn(),
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

import { createApp } from '../src/app.js';
import { User } from '../src/models/user.js';
import { createAuthMiddleware, parseCookieHeader } from '../src/middleware/auth.js';
import { listen, makeCount, makeQuery, request, TEST_CONFIG, type Listening } from './helpers/harness.js';
import jwt from 'jsonwebtoken';

const USER_ID = '507f1f77bcf86cd799439011';
const auth = createAuthMiddleware(TEST_CONFIG.authSecret);

function sessionCookie(userId = USER_ID): string {
  return `lg_session=${auth.signSessionToken(userId)}`;
}

/** Mocks the `User.findById(...).select().lean().exec()` chain. */
function stubUserById(doc: Record<string, unknown> | null): void {
  vi.mocked(User.findById).mockImplementation(
    () => makeQuery(doc ? [doc] : [], 'findOne') as unknown as ReturnType<typeof User.findById>,
  );
}

let server: Listening;

beforeAll(async () => {
  server = await listen(createApp(TEST_CONFIG));
  stubUserById(null);
});

afterAll(async () => {
  await server.close();
});

describe('token roundtrips', () => {
  it('signs and verifies a user session (7d)', () => {
    const token = auth.signSessionToken(USER_ID);
    expect(auth.verifySessionToken(token)).toBe(USER_ID);
  });

  it('rejects expired / tampered tokens', () => {
    const expired = jwt.sign({ sub: USER_ID }, TEST_CONFIG.authSecret, { expiresIn: -10 });
    expect(auth.verifySessionToken(expired)).toBeNull();
    const tampered = jwt.sign({ sub: USER_ID }, 'wrong-secret');
    expect(auth.verifySessionToken(tampered)).toBeNull();
  });

  it('signs and verifies the admin token (role admin, actor env-admin)', () => {
    const token = auth.signAdminToken();
    expect(auth.verifyAdminToken(token)).toBe(true);
    const noRole = jwt.sign({ sub: 'env-admin' }, TEST_CONFIG.authSecret, { expiresIn: '1h' });
    expect(auth.verifyAdminToken(noRole)).toBe(false);
  });
});

describe('requireAuth (REST)', () => {
  it('401 {error:AUTH_REQUIRED} without a cookie', async () => {
    const res = await request(`${server.url}/api/auth/me`);
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: 'AUTH_REQUIRED' });
  });

  it('401 on garbage token without touching the DB', async () => {
    vi.mocked(User.findById).mockClear();
    const res = await request(`${server.url}/api/auth/me`, {
      headers: { cookie: 'lg_session=garbage.token.here' },
    });
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: 'AUTH_REQUIRED' });
    expect(vi.mocked(User.findById)).not.toHaveBeenCalled();
  });

  it('401 when the user no longer exists (stale token)', async () => {
    stubUserById(null);
    const res = await request(`${server.url}/api/auth/me`, {
      headers: { cookie: sessionCookie() },
    });
    expect(res.status).toBe(401);
  });

  it('403 {error:BANNED} for banned users', async () => {
    stubUserById({ _id: USER_ID, nickname: 'Ron', level: 3, banned: true });
    const res = await request(`${server.url}/api/auth/me`, {
      headers: { cookie: sessionCookie() },
    });
    expect(res.status).toBe(403);
    expect(res.body).toEqual({ error: 'BANNED' });
  });

  it('200s with the profile for a valid session', async () => {
    stubUserById({
      _id: USER_ID,
      provider: 'discord',
      name: 'Ron Swanson',
      nickname: 'Ron',
      email: 'ron@pawnee.gov',
      avatarUrl: 'http://cdn.test/a.png',
      avatarSpec: { base: 'default' },
      activeTitle: null,
      level: 9,
      xp: 1200,
      banned: false,
      createdAt: new Date('2026-01-01T00:00:00Z'),
    });
    const res = await request(`${server.url}/api/auth/me`, {
      headers: { cookie: sessionCookie() },
    });
    expect(res.status).toBe(200);
    const body = res.body as { user: Record<string, unknown> };
    expect(body.user['id']).toBe(USER_ID);
    expect(body.user['nickname']).toBe('Ron');
    expect(body.user['banned']).toBe(false);
  });
});

describe('logout', () => {
  it('clears the session cookie', async () => {
    const res = await request(`${server.url}/api/auth/logout`, { method: 'POST' });
    expect(res.status).toBe(200);
    const setCookie = res.headers.getSetCookie().join('\n');
    expect(setCookie).toContain('lg_session=');
  });
});

describe('socket seam (S1 reuse)', () => {
  it('parses a named cookie out of a raw header', () => {
    expect(parseCookieHeader('a=1; lg_session=abc%20def; b=2', 'lg_session')).toBe('abc def');
    expect(parseCookieHeader('a=1', 'lg_session')).toBeUndefined();
    expect(parseCookieHeader(undefined, 'lg_session')).toBeUndefined();
  });

  it('authenticateSocket resolves null without a cookie, user with one', async () => {
    const anonymousSocket = { request: { headers: {} } } as unknown as Socket;
    await expect(auth.authenticateSocket(anonymousSocket)).resolves.toBeNull();
    stubUserById({ _id: USER_ID, nickname: 'Ron', level: 3, banned: false });
    const socket = {
      request: { headers: { cookie: sessionCookie() } },
    } as unknown as Socket;
    const user = await auth.authenticateSocket(socket);
    expect(user?.id).toBe(USER_ID);
  });

  it('authenticateSocket resolves null for banned users', async () => {
    stubUserById({ _id: USER_ID, nickname: 'Ron', level: 3, banned: true });
    const socket = {
      request: { headers: { cookie: sessionCookie() } },
    } as unknown as Socket;
    await expect(auth.authenticateSocket(socket)).resolves.toBeNull();
  });
});

describe('admin guard', () => {
  it('401 {error:ADMIN_REQUIRED} without / with a bad admin cookie', async () => {
    const noCookie = await request(`${server.url}/api/admin/users`);
    expect(noCookie.status).toBe(401);
    expect(noCookie.body).toEqual({ error: 'ADMIN_REQUIRED' });
    const wrongCookie = await request(`${server.url}/api/admin/users`, {
      headers: { cookie: `lg_admin=${auth.signSessionToken(USER_ID)}` },
    });
    expect(wrongCookie.status).toBe(401);
    expect(wrongCookie.body).toEqual({ error: 'ADMIN_REQUIRED' });
  });

  it('admin cookie gets into the protected surface', async () => {
    vi.mocked(User.find).mockReturnValue(
      makeQuery([]) as unknown as ReturnType<typeof User.find>,
    );
    vi.mocked(User.countDocuments).mockImplementation(
      () => makeCount(1) as unknown as ReturnType<typeof User.countDocuments>,
    );
    const res = await request(`${server.url}/api/admin/users`, {
      headers: { cookie: `lg_admin=${auth.signAdminToken()}` },
    });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      page: 1,
      perPage: 20,
      total: 1,
      users: [],
    });
  });
});
