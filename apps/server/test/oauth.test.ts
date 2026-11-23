/**
 * OAuth surface (STR/07 §0, STR/08 §13): authorize URL shapes, 503 when a
 * provider is unconfigured (missing creds never crash boot), state CSRF
 * checks, profile upsert + session issue.
 */
import { describe, it, expect, beforeAll, afterAll, afterEach, beforeEach, vi } from 'vitest';

vi.mock('../src/models/user.js', () => ({
  User: {
    findById: vi.fn(),
    findOneAndUpdate: vi.fn(),
    find: vi.fn(),
    countDocuments: vi.fn(),
    updateOne: vi.fn(),
  },
}));

import { createApp } from '../src/app.js';
import { User } from '../src/models/user.js';
import {
  buildDiscordAuthorizeUrl,
  buildGoogleAuthorizeUrl,
  getDiscordOAuth,
  getGoogleOAuth,
} from '../src/lib/oauth.js';
import {
  listen,
  makeQuery,
  request,
  json,
  tinyLimiter,
  TEST_CONFIG,
  type Listening,
} from './helpers/harness.js';

interface Recorded {
  url: string;
  method: string;
  headers: Record<string, string>;
  body?: unknown;
}

interface Staged {
  status: number;
  body: unknown;
}

const stagedQueue: Staged[] = [];
const oauthCalls: Recorded[] = [];

async function stagedFetch(url: string, init?: RequestInit): Promise<Response> {
  oauthCalls.push({
    url,
    method: String(init?.method ?? 'GET'),
    headers: (init?.headers ?? {}) as Record<string, string>,
    body: init?.body,
  });
  const next = stagedQueue.shift();
  if (!next) throw new Error('no staged response for ' + url);
  const text = next.body === undefined ? '' : JSON.stringify(next.body);
  return new Response(text, { status: next.status, headers: { 'content-type': 'application/json' } });
}

let server: Listening;

beforeAll(async () => {
  const unlimited = tinyLimiter(1_000_000);
  server = await listen(
    createApp(TEST_CONFIG, {
      limiters: { billing: unlimited, auth: unlimited, admin: unlimited, login: unlimited },
      fetchImpl: stagedFetch,
    }),
  );
});

afterAll(async () => {
  await server.close();
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
  oauthCalls.length = 0;
  stagedQueue.length = 0;
});

beforeEach(() => {
  vi.stubEnv('DISCORD_CLIENT_ID', 'discord-client-id');
  vi.stubEnv('DISCORD_CLIENT_SECRET', 'discord-client-secret');
  vi.stubEnv('GOOGLE_CLIENT_ID', 'google-client-id');
  vi.stubEnv('GOOGLE_CLIENT_SECRET', 'google-client-secret');
});

beforeEach(() => {
  vi.stubEnv('DISCORD_CLIENT_ID', 'discord-client-id');
  vi.stubEnv('DISCORD_CLIENT_SECRET', 'discord-client-secret');
  vi.stubEnv('GOOGLE_CLIENT_ID', 'google-client-id');
  vi.stubEnv('GOOGLE_CLIENT_SECRET', 'google-client-secret');
});

describe('unconfigured providers never crash boot — they 503', () => {
  it('503 {error:OAUTH_NOT_CONFIGURED, provider} for each provider', async () => {
    vi.stubEnv('DISCORD_CLIENT_ID', '');
    vi.stubEnv('GOOGLE_CLIENT_SECRET', '');
    const discord = await request(`${server.url}/api/auth/discord`);
    expect(discord.status).toBe(503);
    expect(discord.body).toEqual({
      error: 'OAUTH_NOT_CONFIGURED',
      provider: 'discord',
      message: 'set DISCORD_CLIENT_ID + secret in env',
    });
    const google = await request(`${server.url}/api/auth/google`);
    expect(google.status).toBe(503);
    expect((google.body as Record<string, unknown>)['provider']).toBe('google');
  });
});

describe('authorize redirects', () => {
  it('Discord: identify scope, APP_URL callback, one-time state cookie', async () => {
    const res = await request(`${server.url}/api/auth/discord`);
    expect(res.status).toBe(302);
    const location = res.headers.get('location') ?? '';
    expect(location.startsWith('https://discord.com/api/oauth2/authorize?')).toBe(true);
    const params = new URLSearchParams(location.slice(location.indexOf('?') + 1));
    expect(params.get('client_id')).toBe('discord-client-id');
    expect(params.get('redirect_uri')).toBe('http://localhost:3100/api/auth/discord/callback');
    expect(params.get('response_type')).toBe('code');
    expect(params.get('scope')).toBe('identify');
    expect((params.get('state') ?? '').length).toBe(48); // 24 random bytes hex
    const setCookie = res.headers.getSetCookie().join('\n');
    expect(setCookie).toContain('lg_oauth_state=');
  });

  it('Google: openid email profile scopes, APP_URL callback', async () => {
    const res = await request(`${server.url}/api/auth/google`);
    expect(res.status).toBe(302);
    const location = res.headers.get('location') ?? '';
    expect(location.startsWith('https://accounts.google.com/o/oauth2/v2/auth?')).toBe(true);
    const params = new URLSearchParams(location.slice(location.indexOf('?') + 1));
    expect(params.get('client_id')).toBe('google-client-id');
    expect(params.get('redirect_uri')).toBe('http://localhost:3100/api/auth/google/callback');
    expect(params.get('scope')).toBe('openid email profile');
  });

  it('builds the same URLs from the lib with explicit creds', () => {
    const discord = buildDiscordAuthorizeUrl(
      { clientId: 'cid', clientSecret: 'sec' },
      'http://app.test/api/auth/discord/callback',
      'state123',
    );
    expect(discord).toContain('client_id=cid');
    expect(discord).toContain('state=state123');
    const google = buildGoogleAuthorizeUrl(
      { clientId: 'gid', clientSecret: 'gsec' },
      'http://app.test/api/auth/google/callback',
      'state123',
    );
    expect(google).toContain('scope=openid+email+profile');
  });
});

describe('callbacks', () => {
  it('rejects a state mismatch (CSRF) before any code exchange', async () => {
    const res = await request(
      `${server.url}/api/auth/discord/callback?code=x&state=evil`,
    );
    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toContain('status=error');
    expect(res.headers.get('location')).toContain('reason=state');
    expect(oauthCalls).toHaveLength(0);
  });

  it('maps provider deny to reason=denied', async () => {
    const res = await request(`${server.url}/api/auth/discord/callback?error=access_denied`);
    expect(res.headers.get('location')).toContain('reason=denied');
  });

  it('Discord happy path: exchange → profile → upsert → session → redirect', async () => {
    // Prime: get a valid state + state cookie from the authorize endpoint.
    const begin = await request(`${server.url}/api/auth/discord`);
    const location = begin.headers.get('location') ?? '';
    const state = new URLSearchParams(location.slice(location.indexOf('?') + 1)).get('state') ?? '';
    const stateCookie = begin.headers
      .getSetCookie()
      .map((c) => c.split(';')[0])
      .join('; ');

    stagedQueue.push(
      { status: 200, body: { access_token: 'discord-at', token_type: 'Bearer' } },
      { status: 200, body: { id: 'd123', username: 'liar', global_name: 'Johnny' } },
    );

    vi.mocked(User.findOneAndUpdate).mockImplementation(
      () =>
        makeQuery([{ _id: '507f1f77bcf86cd799439011', nickname: 'Johnny', banned: false }], 'findOne') as unknown as ReturnType<
          typeof User.findOneAndUpdate
        >,
    );

    const res = await request(
      `${server.url}/api/auth/discord/callback?code=authcode&state=${encodeURIComponent(state)}`,
      { headers: { cookie: stateCookie } },
    );
    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toBe('http://localhost:3100/auth/callback?status=ok');
    expect(res.headers.getSetCookie().join('\n')).toContain('lg_session=');

    // Exact exchange wire shape.
    const exchange = oauthCalls.find((c) => c.url === 'https://discord.com/api/oauth2/token');
    expect(exchange?.method).toBe('POST');
    expect(exchange?.headers['content-type']).toBe('application/x-www-form-urlencoded');
    const form = new URLSearchParams(String(exchange?.body));
    expect(form.get('client_id')).toBe('discord-client-id');
    expect(form.get('grant_type')).toBe('authorization_code');
    expect(form.get('code')).toBe('authcode');
    expect(form.get('redirect_uri')).toBe('http://localhost:3100/api/auth/discord/callback');

    const profile = oauthCalls.find((c) => c.url === 'https://discord.com/api/users/@me');
    expect(profile?.headers['authorization']).toBe('Bearer discord-at');

    // Upsert keyed on (provider, providerId).
    expect(vi.mocked(User.findOneAndUpdate)).toHaveBeenCalledWith(
      { provider: 'discord', providerId: 'd123' },
      expect.objectContaining({
        $set: expect.objectContaining({ name: 'Johnny', lastSeenAt: expect.any(Date) }),
        $setOnInsert: expect.objectContaining({ nickname: 'Johnny', level: 1, xp: 0 }),
      }),
      { upsert: true, new: true },
    );
  });

  it('banned users get reason=banned and NO session cookie', async () => {
    const begin = await request(`${server.url}/api/auth/discord`);
    const location = begin.headers.get('location') ?? '';
    const state = new URLSearchParams(location.slice(location.indexOf('?') + 1)).get('state') ?? '';
    const stateCookie = begin.headers
      .getSetCookie()
      .map((c) => c.split(';')[0])
      .join('; ');
    stagedQueue.push(
      { status: 200, body: { access_token: 'discord-at' } },
      { status: 200, body: { id: 'd123', username: 'liar', global_name: 'Banned Guy' } },
    );
    vi.mocked(User.findOneAndUpdate).mockImplementation(
      () =>
        makeQuery([{ _id: '507f1f77bcf86cd799439011', nickname: 'Banned Guy', banned: true }], 'findOne') as unknown as ReturnType<
          typeof User.findOneAndUpdate
        >,
    );
    const res = await request(
      `${server.url}/api/auth/discord/callback?code=authcode&state=${encodeURIComponent(state)}`,
      { headers: { cookie: stateCookie } },
    );
    expect(res.headers.get('location')).toContain('reason=banned');
    expect(res.headers.getSetCookie().join('\n')).not.toContain('lg_session=');
  });

  it('Google happy path issues a session too', async () => {
    const begin = await request(`${server.url}/api/auth/google`);
    const location = begin.headers.get('location') ?? '';
    const state = new URLSearchParams(location.slice(location.indexOf('?') + 1)).get('state') ?? '';
    const stateCookie = begin.headers
      .getSetCookie()
      .map((c) => c.split(';')[0])
      .join('; ');
    stagedQueue.push(
      { status: 200, body: { access_token: 'google-at' } },
      { status: 200, body: { sub: 'g9', name: 'Gus Fring', email: 'gus@lospolloshermanos.com', picture: 'http://cdn.test/gus.png' } },
    );
    vi.mocked(User.findOneAndUpdate).mockImplementation(
      () =>
        makeQuery([{ _id: '507f1f77bcf86cd799439012', nickname: 'Gus Fring', banned: false }], 'findOne') as unknown as ReturnType<
          typeof User.findOneAndUpdate
        >,
    );
    const res = await request(
      `${server.url}/api/auth/google/callback?code=authcode&state=${encodeURIComponent(state)}`,
      { headers: { cookie: stateCookie } },
    );
    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toBe('http://localhost:3100/auth/callback?status=ok');
    expect(vi.mocked(User.findOneAndUpdate)).toHaveBeenCalledWith(
      { provider: 'google', providerId: 'g9' },
      expect.objectContaining({
        $set: expect.objectContaining({ email: 'gus@lospolloshermanos.com' }),
      }),
      { upsert: true, new: true },
    );
  });

  it('exchange failures redirect with reason=exchange (no session)', async () => {
    const begin = await request(`${server.url}/api/auth/discord`);
    const location = begin.headers.get('location') ?? '';
    const state = new URLSearchParams(location.slice(location.indexOf('?') + 1)).get('state') ?? '';
    const stateCookie = begin.headers
      .getSetCookie()
      .map((c) => c.split(';')[0])
      .join('; ');
    stagedQueue.push({ status: 400, body: { error: 'invalid_grant' } });
    const res = await request(
      `${server.url}/api/auth/discord/callback?code=badcode&state=${encodeURIComponent(state)}`,
      { headers: { cookie: stateCookie } },
    );
    expect(res.headers.get('location')).toContain('reason=exchange');
    expect(res.headers.getSetCookie().join('\n')).not.toContain('lg_session=');
  });
});

describe('env credential readers', () => {
  it('reads provider creds from process.env (TODO-sync-with-shared seam)', () => {
    expect(getDiscordOAuth()).toEqual({ clientId: 'discord-client-id', clientSecret: 'discord-client-secret' });
    expect(getGoogleOAuth()).toEqual({ clientId: 'google-client-id', clientSecret: 'google-client-secret' });
    vi.stubEnv('DISCORD_CLIENT_SECRET', '');
    expect(getDiscordOAuth()).toBeNull();
  });
});
