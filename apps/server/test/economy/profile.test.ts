/**
 * GET /api/me + /api/me/profile (authed) — the exact profile aggregate W3
 * wires against: user (explicit no-PII projection), canonical level +
 * levelProgress, equipped title, derived coin balance, unlocked title count,
 * last 10 lean match records with the caller's own line.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';

vi.mock('../../src/models/user.js', () => ({
  User: { find: vi.fn(), findById: vi.fn(), findOneAndUpdate: vi.fn(), updateOne: vi.fn(), countDocuments: vi.fn() },
}));

vi.mock('../../src/models/match-record.js', () => ({
  MatchRecord: { create: vi.fn(), aggregate: vi.fn(), find: vi.fn() },
}));

vi.mock('../../src/economy/models/title-progress.js', () => ({
  TitleProgress: { updateOne: vi.fn(), countDocuments: vi.fn(), aggregate: vi.fn() },
}));

vi.mock('../../src/models/wallet-ledger.js', () => ({
  WalletLedger: { countDocuments: vi.fn(), aggregate: vi.fn() },
  LEDGER_REASONS: [
    'win',
    'survived_round',
    'purchase',
    'spend',
    'adjust',
    'match_reward',
  ] as const,
}));

vi.mock('../../src/lib/wallet.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/lib/wallet.js')>();
  return {
    ...actual,
    deriveBalance: vi.fn(async (): Promise<number> => 0),
    deriveBalances: vi.fn(async (): Promise<Map<string, number>> => new Map()),
    appendLedger: vi.fn(),
  };
});

import { createApp } from '../../src/app.js';
import { User } from '../../src/models/user.js';
import { MatchRecord } from '../../src/models/match-record.js';
import { TitleProgress } from '../../src/economy/models/title-progress.js';
import { deriveBalance } from '../../src/lib/wallet.js';
import { createAuthMiddleware } from '../../src/middleware/auth.js';
import {
  makeQuery,
  listen,
  request,
  TEST_CONFIG,
  type Listening,
} from '../helpers/harness.js';

const USER_ID = '507f1f77bcf86cd7994d9001';
const auth = createAuthMiddleware(TEST_CONFIG.authSecret);
const session = { cookie: `lg_session=${auth.signSessionToken(USER_ID)}` };

const PROFILE_USER = {
  _id: USER_ID,
  provider: 'google',
  providerId: 's3cret-pid-9',
  email: 'hidden-mail-s3cret@test',
  name: 'Ron Weasley',
  nickname: 'Ron',
  avatarUrl: null,
  avatarSpec: { base: 'default', hat: 'hat:cowboy' },
  activeTitle: 'sharp-eye',
  role: 'user',
  xp: 733,
  level: 42, // stored STALE — canonical must be 2 (computeLevel(733))
  banned: false,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  lastSeenAt: new Date('2026-11-23T00:00:00.000Z'),
};

const MY_RECORD = {
  _id: 'rec1',
  matchId: 'm_20261123_0001',
  roomCode: 'XKD2P',
  endedAt: new Date('2026-11-23T21:30:00.000Z'),
  capacity: 5,
  theme: 'saloon',
  players: [
    {
      accountId: USER_ID,
      seat: 0,
      nickname: 'Ron',
      titleAtPlay: 'sharp-eye',
      stats: {
        kills: 1,
        catches: 2,
        falseAccusations: 0,
        bluffSuccesses: 3,
        deaths: 0,
        pullsSurvived: 1,
        roundsPlayed: 3,
        won: true,
        xpEarned: 12,
        coinsEarned: 8,
      },
    },
    { accountId: '507f1f77bcf86cd799439002', seat: 1, nickname: 'Snake', stats: {} },
  ],
  summary: { rounds: 3, totalPulls: 4, dareDevilMoments: 1 },
};

const FOREIGN_RECORD = {
  _id: 'rec2',
  matchId: 'm_20261123_0002',
  roomCode: 'AAAAA',
  endedAt: new Date('2026-11-23T20:30:00.000Z'),
  capacity: 2,
  theme: 'saloon',
  players: [{ accountId: '507f1f77bcf86cd799439003', seat: 0, nickname: 'Other', stats: {} }],
  summary: { rounds: 1, totalPulls: 1, dareDevilMoments: 0 },
};

let server: Listening;

beforeAll(async () => {
  server = await listen(createApp(TEST_CONFIG));
});

afterAll(async () => {
  await server.close();
});

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(User.findById).mockImplementation(
    (() => makeQuery([PROFILE_USER], 'findOne')) as unknown as typeof User.findById,
  );
  vi.mocked(deriveBalance).mockResolvedValue(950);
  vi.mocked(TitleProgress.countDocuments).mockImplementation(
    (() => ({ exec: async () => 3 })) as unknown as typeof TitleProgress.countDocuments,
  );
  vi.mocked(MatchRecord.find).mockImplementation(
    (() => makeQuery([MY_RECORD, FOREIGN_RECORD])) as unknown as typeof MatchRecord.find,
  );
});

describe("GET /api/me (profile aggregate — W3's contract)", () => {
  it('requires a session (401 on both aliases)', async () => {
    for (const path of ['/api/me', '/api/me/profile']) {
      const res = await request(`${server.url}${path}`);
      expect(res.status).toBe(401);
      expect(res.body).toEqual({ error: 'AUTH_REQUIRED' });
    }
  });

  it('aggregates user + canonical level + levelProgress + title + coins + titleCount + records', async () => {
    const res = await request(`${server.url}/api/me`, { headers: session });
    expect(res.status).toBe(200);

    const body = res.body as Record<string, unknown>;
    const user = body['user'] as Record<string, unknown>;
    expect(user).toEqual({
      id: USER_ID,
      nickname: 'Ron',
      name: 'Ron Weasley',
      avatarUrl: null,
      avatarSpec: { base: 'default', hat: 'hat:cowboy' },
      activeTitle: 'sharp-eye',
      role: 'user',
      xp: 733,
      level: 2, // canonical computeLevel(733) — the stored 42 is ignored
      createdAt: '2026-01-01T00:00:00.000Z',
      lastSeenAt: '2026-11-23T00:00:00.000Z',
    });
    expect(body['level']).toBe(2);
    expect(body['levelProgress']).toEqual({
      level: 2,
      xp: 733,
      xpIntoLevel: 0,
      xpToNextLevel: 786,
      xpForLevel: 786,
      percent: 0,
      atMax: false,
    });
    expect(body['title']).toBe('sharp-eye');
    expect(body['coins']).toBe(950); // deriveBalance
    expect(body['unlockedTitleCount']).toBe(3);

    const records = body['recentMatchRecords'] as Array<Record<string, unknown>>;
    expect(records).toHaveLength(1); // foreign record dropped
    expect(records[0]).toMatchObject({
      matchId: 'm_20261123_0001',
      roomCode: 'XKD2P',
      theme: 'saloon',
      capacity: 5,
      you: {
        seat: 0,
        nickname: 'Ron',
        titleAtPlay: 'sharp-eye',
        stats: {
          kills: 1,
          catches: 2,
          bluffSuccesses: 3,
          deaths: 0,
          won: true,
          xpEarned: 12,
          coinsEarned: 8,
        },
      },
    });
    expect(vi.mocked(MatchRecord.find)).toHaveBeenCalledWith({
      'players.accountId': USER_ID,
    });
  });

  it('NEVER leaks own email/provider identity in the response', async () => {
    const res = await request(`${server.url}/api/me`, { headers: session });
    const serialized = JSON.stringify(res.body);
    expect(serialized).not.toContain('hidden-mail-s3cret');
    expect(serialized).not.toContain('s3cret-pid-9');
    expect(serialized).not.toContain('google');
    expect(serialized).not.toContain('provider');
  });

  it('GET /api/me/profile returns the identical aggregate (alias)', async () => {
    const me = await request(`${server.url}/api/me`, { headers: session });
    const alias = await request(`${server.url}/api/me/profile`, { headers: session });
    expect(alias.status).toBe(200);
    expect(alias.body).toEqual(me.body);
  });

  it('404s when the session points at a deleted user (auth ok, profile read null)', async () => {
    const impl = User.findById;
    vi.mocked(impl).mockImplementationOnce(
      (() => makeQuery([PROFILE_USER], 'findOne')) as unknown as typeof impl,
    );
    vi.mocked(impl).mockImplementationOnce(
      (() => makeQuery([], 'findOne')) as unknown as typeof impl,
    );
    const res = await request(`${server.url}/api/me/profile`, { headers: session });
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'USER_NOT_FOUND' });
  });

  it('403s banned users before the profile handler runs', async () => {
    vi.mocked(User.findById).mockImplementation(
      (() =>
        makeQuery([{ ...PROFILE_USER, banned: true }], 'findOne')) as unknown as typeof User.findById,
    );
    const res = await request(`${server.url}/api/me`, { headers: session });
    expect(res.status).toBe(403);
    expect(res.body).toEqual({ error: 'BANNED' });
  });
});
