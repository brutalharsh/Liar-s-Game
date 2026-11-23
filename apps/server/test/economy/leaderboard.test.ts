/**
 * GET /api/leaderboard (STR/09 derived reads) — xp/wins/kills/titles,
 * pagination + rank math, 60s cache, and THE public-projection rule:
 * email/provider/providerId/ip NEVER appear in any response body.
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
import { clearLeaderboardCache } from '../../src/economy/leaderboard.js';
import { makeQuery, listen, request, TEST_CONFIG, type Listening } from '../helpers/harness.js';

const ACC_1 = '507f1f77bcf86cd7994391a1';
const ACC_2 = '507f1f77bcf86cd7994391b2';
const ACC_3 = '507f1f77bcf86cd7994393c3';

/** Public display rows (pre-sorted by xp desc as the mocked sort is identity). */
const XP_ROWS = [
  {
    _id: ACC_1,
    nickname: 'Alpha',
    email: 'alpha@secret-mail.test',
    provider: 'discord',
    providerId: 'pid-alpha-s3cret',
    banReason: 'TOP_SECRET_REASON',
    avatarSpec: { base: 'default' },
    activeTitle: 'sharp-eye',
    level: 12,
    xp: 1000,
    banned: false,
  },
  {
    _id: ACC_2,
    nickname: 'Bravo',
    email: 'bravo@secret-mail.test',
    provider: 'google',
    providerId: 'pid-bravo-s3cret',
    activeTitle: null,
    level: 5,
    xp: 700,
    banned: false,
  },
  {
    _id: ACC_3,
    nickname: 'Charlie',
    email: 'charlie@secret-mail.test',
    providerId: 'pid-charlie-s3cret',
    level: 2,
    xp: 400,
    banned: false,
  },
];

let server: Listening;

beforeAll(async () => {
  server = await listen(createApp(TEST_CONFIG));
});

afterAll(async () => {
  await server.close();
});

beforeEach(() => {
  vi.clearAllMocks();
  clearLeaderboardCache();
  vi.mocked(User.find).mockImplementation(
    (() => makeQuery(XP_ROWS)) as unknown as typeof User.find,
  );
  vi.mocked(User.countDocuments).mockImplementation(
    (() => ({ exec: async () => 3 })) as unknown as typeof User.countDocuments,
  );
  vi.mocked(MatchRecord.aggregate).mockImplementation(
    (() => ({
      session: vi.fn(),
      exec: async () => [
        {
          rows: [
            { _id: ACC_1, value: 7 },
            { _id: ACC_2, value: 3 },
          ],
          total: [{ count: 2 }],
        },
      ],
    })) as unknown as typeof MatchRecord.aggregate,
  );
  vi.mocked(TitleProgress.aggregate).mockImplementation(
    (() => ({
      session: vi.fn(),
      exec: async () => [
        {
          rows: [
            { _id: ACC_2, value: 5 },
            { _id: ACC_1, value: 4 },
          ],
          total: [{ count: 2 }],
        },
      ],
    })) as unknown as typeof TitleProgress.aggregate,
  );
});

describe('GET /api/leaderboard (default metric=xp)', () => {
  it('ranks by xp desc with rank + value + display fields', async () => {
    const res = await request(`${server.url}/api/leaderboard`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      metric: 'xp',
      page: 1,
      perPage: 20,
      total: 3,
      leaderboard: [
        {
          accountId: ACC_1,
          nickname: 'Alpha',
          avatarSpec: { base: 'default' },
          activeTitle: 'sharp-eye',
          level: 12,
          rank: 1,
          value: 1000,
        },
        { accountId: ACC_2, nickname: 'Bravo', activeTitle: null, level: 5, rank: 2, value: 700 },
        {
          accountId: ACC_3,
          nickname: 'Charlie',
          activeTitle: null,
          level: 2,
          rank: 3,
          value: 400,
        },
      ],
    });
    expect(res.headers.get('cache-control')).toBe('public, max-age=60');
  });

  it('NEVER leaks PII — email/provider/providerId/banReason absent from body', async () => {
    const res = await request(`${server.url}/api/leaderboard`);
    const serialized = JSON.stringify(res.body);
    expect(serialized).not.toContain('secret-mail.test');
    expect(serialized).not.toContain('pid-');
    expect(serialized).not.toContain('discord');
    expect(serialized).not.toContain('google');
    expect(serialized).not.toContain('banReason');
    expect(serialized).not.toContain('TOP_SECRET_REASON');
    const first = (res.body as { leaderboard: Array<Record<string, unknown>> }).leaderboard[0];
    expect(Object.keys(first ?? {}).sort()).toEqual([
      'accountId',
      'activeTitle',
      'avatarSpec',
      'level',
      'nickname',
      'rank',
      'value',
    ]);
  });

  it('paginates: page=2&perPage=2 → rank math continues (offset 2 → rank 3)', async () => {
    vi.mocked(User.find).mockImplementation(
      (() => makeQuery([XP_ROWS[2] as never])) as unknown as typeof User.find,
    );
    vi.mocked(User.countDocuments).mockImplementation(
      (() => ({ exec: async () => 5 })) as unknown as typeof User.countDocuments,
    );
    const res = await request(`${server.url}/api/leaderboard?page=2&perPage=2`);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ metric: 'xp', page: 2, perPage: 2, total: 5 });
    const leaderboard = (res.body as { leaderboard: Array<Record<string, unknown>> }).leaderboard;
    expect(leaderboard).toHaveLength(1);
    expect(leaderboard[0]).toMatchObject({ accountId: ACC_3, rank: 3, value: 400 });
  });

  it('caches per (metric,page,perPage) for 60s — one query per key', async () => {
    await request(`${server.url}/api/leaderboard`);
    await request(`${server.url}/api/leaderboard`);
    expect(vi.mocked(User.find)).toHaveBeenCalledTimes(1);
    clearLeaderboardCache();
    await request(`${server.url}/api/leaderboard`);
    expect(vi.mocked(User.find)).toHaveBeenCalledTimes(2);
    // A different key is NOT served from the same cache slot.
    await request(`${server.url}/api/leaderboard?page=3`);
    expect(vi.mocked(User.find)).toHaveBeenCalledTimes(3);
  });
});

describe('GET /api/leaderboard?metric=wins|kills|titles (match_records / title_progress)', () => {
  it('wins: facet rows over match_records, enriched with public display fields', async () => {
    const res = await request(`${server.url}/api/leaderboard?metric=wins`);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ metric: 'wins', total: 2 });
    const leaderboard = (res.body as { leaderboard: Array<Record<string, unknown>> }).leaderboard;
    expect(leaderboard[0]).toMatchObject({
      accountId: ACC_1,
      nickname: 'Alpha',
      rank: 1,
      value: 7,
    });
    expect(leaderboard[1]).toMatchObject({ accountId: ACC_2, rank: 2, value: 3 });
    // Aggregate metric over match_records players (wins via stats.won).
    const pipeline = vi.mocked(MatchRecord.aggregate).mock
      .calls[0]?.[0] as unknown as Array<Record<string, unknown>>;
    expect(pipeline[0]).toEqual({ $unwind: '$players' });
    expect(JSON.stringify(pipeline)).toContain('$players.stats.won');
  });

  it('kills: same pipeline but sums stats.kills', async () => {
    const res = await request(`${server.url}/api/leaderboard?metric=kills`);
    expect(res.status).toBe(200);
    expect((res.body as { leaderboard: unknown[] }).leaderboard).toHaveLength(2);
    expect(JSON.stringify(vi.mocked(MatchRecord.aggregate).mock.calls[0])).toContain(
      '$players.stats.kills',
    );
  });

  it('titles: groups title_progress per account', async () => {
    const res = await request(`${server.url}/api/leaderboard?metric=titles`);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ metric: 'titles', total: 2 });
    const leaderboard = (res.body as { leaderboard: Array<Record<string, unknown>> }).leaderboard;
    expect(leaderboard[0]).toMatchObject({ accountId: ACC_2, rank: 1, value: 5 });
    expect(leaderboard[1]).toMatchObject({ accountId: ACC_1, rank: 2, value: 4 });
    expect(vi.mocked(TitleProgress.aggregate)).toHaveBeenCalledTimes(1);
  });

  it('drops rows for users the enrich query cannot produce (deleted/banned)', async () => {
    vi.mocked(User.find).mockImplementation(
      (() => makeQuery([XP_ROWS[1]])) as unknown as typeof User.find,
    );
    const res = await request(`${server.url}/api/leaderboard?metric=wins`);
    const leaderboard = (res.body as { leaderboard: unknown[] }).leaderboard;
    expect(leaderboard).toHaveLength(1);
    expect(
      (leaderboard[0] as Record<string, unknown>)['accountId'],
    ).toBe(ACC_2);
  });
});

describe('query validation (generous zod)', () => {
  it('rejects unknown metrics and out-of-range pages', async () => {
    for (const qs of ['?metric=cheese', '?page=0', '?perPage=999', '?page=-1']) {
      const res = await request(`${server.url}/api/leaderboard${qs}`);
      expect(res.status).toBe(400);
      expect((res.body as Record<string, unknown>)['error']).toBe('BAD_REQUEST');
    }
  });

  it('accepts numeric strings through coerce (page=2, perPage=5)', async () => {
    vi.mocked(User.countDocuments).mockImplementation(
      (() => ({ exec: async () => 0 })) as unknown as typeof User.countDocuments,
    );
    const res = await request(`${server.url}/api/leaderboard?page=2&perPage=5`);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ page: 2, perPage: 5, total: 0 });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// A8 pins — derived-read design choices observed under the edge audit
// ─────────────────────────────────────────────────────────────────────────────

describe('A8 pins — deleted/banned visibility + cache design', () => {
  it('visible-rank compaction: a dropped top row hands rank 1 to the next visible player', async () => {
    // Accepted v1 semantics: ranks are positions among VISIBLE rows — the
    // same thing the xp metric does by filtering banned before pagination.
    vi.mocked(User.find).mockImplementation(
      (() => makeQuery([XP_ROWS[1]])) as unknown as typeof User.find,
    );
    const res = await request(`${server.url}/api/leaderboard?metric=wins`);
    const body = res.body as Record<string, unknown>;
    const leaderboard = body['leaderboard'] as Array<Record<string, unknown>>;
    expect(leaderboard).toHaveLength(1);
    expect(leaderboard[0]).toMatchObject({ accountId: ACC_2, rank: 1 });
    // ...but `total` still counts the hidden identity (aggregation $count) —
    // flagged upstream as a pagination nuance, pinned here so it is visible.
    expect(body['total']).toBe(2);
  });

  it('a page whose every row is hidden renders empty while total > 0 (flagged, accepted)', async () => {
    vi.mocked(User.find).mockImplementation(
      (() => makeQuery([])) as unknown as typeof User.find,
    );
    const res = await request(`${server.url}/api/leaderboard?metric=kills`);
    const body = res.body as Record<string, unknown>;
    expect(res.status).toBe(200);
    expect(body['leaderboard']).toEqual([]);
    expect(body['total']).toBe(2);
  });

  it('60s TTL serves PRE-grant rows until clearLeaderboardCache() — no write-path invalidation exists', async () => {
    // Design choice under audit (grep-verified): grantMatchRewards never
    // calls clearLeaderboardCache; post-grant staleness is bounded by TTL.
    await request(`${server.url}/api/leaderboard?metric=wins`); // prime the cache
    const readsBefore = vi.mocked(MatchRecord.aggregate).mock.calls.length;
    // A grant lands: the metric's underlying answer changes…
    vi.mocked(MatchRecord.aggregate).mockImplementation(
      (() => ({
        session: vi.fn(),
        exec: async () => [
          { rows: [{ _id: ACC_2, value: 99 }, { _id: ACC_1, value: 7 }], total: [{ count: 2 }] },
        ],
      })) as unknown as typeof MatchRecord.aggregate,
    );
    const stale = await request(`${server.url}/api/leaderboard?metric=wins`);
    expect(vi.mocked(MatchRecord.aggregate).mock.calls.length).toBe(readsBefore); // no re-query
    const staleRows = (stale.body as { leaderboard: Array<Record<string, unknown>> }).leaderboard;
    expect(staleRows[0]).toMatchObject({ accountId: ACC_1, value: 7 }); // PRE-grant data
    clearLeaderboardCache();
    const fresh = await request(`${server.url}/api/leaderboard?metric=wins`);
    const freshRows = (fresh.body as { leaderboard: Array<Record<string, unknown>> }).leaderboard;
    expect(freshRows[0]).toMatchObject({ accountId: ACC_2, value: 99 }); // post-grant truth
  });
});
