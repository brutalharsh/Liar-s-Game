/**
 * grantMatchRewards (E1 seam) — idempotence (anchor + txId), concurrency
 * (duplicate-key path), anti-farm cap, banned/unknown/no-account skips,
 * title unlocks, prestige entitlements, match_records + replay persistence,
 * payload zod rejection, and the contract-fidelity end-to-end: a realistic
 * rules-engine MatchRecord moves ledger + users + match_records + xp_events.
 */
import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest';

vi.mock('../../src/models/user.js', () => ({
  User: { findById: vi.fn(), updateOne: vi.fn(), find: vi.fn(), countDocuments: vi.fn() },
}));

vi.mock('../../src/models/match-record.js', () => ({
  MatchRecord: { create: vi.fn(), aggregate: vi.fn(), find: vi.fn() },
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

vi.mock('../../src/models/catalog-item.js', () => ({
  CatalogItem: { find: vi.fn(), findById: vi.fn() },
  CATALOG_CATEGORIES: [
    'hair',
    'beard',
    'hat',
    'shirt',
    'glasses',
    'frame',
    'anim',
    'voicePack',
    'theme',
  ] as const,
  CATALOG_TIERS: ['common', 'rare', 'epic'] as const,
}));

vi.mock('../../src/models/entitlement.js', () => ({
  Entitlement: { create: vi.fn(), findOne: vi.fn(), find: vi.fn() },
  ENTITLEMENT_KINDS: ['item', 'theme', 'title', 'capacity'] as const,
}));

vi.mock('../../src/economy/models/xp-event.js', () => ({
  XpEvent: { create: vi.fn() },
}));

vi.mock('../../src/economy/models/title-progress.js', () => ({
  TitleProgress: { updateOne: vi.fn(), countDocuments: vi.fn(), aggregate: vi.fn() },
}));

vi.mock('../../src/economy/models/match-replay.js', () => ({
  MatchReplay: { create: vi.fn() },
}));

vi.mock('../../src/lib/wallet.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/lib/wallet.js')>();
  return {
    ...actual,
    deriveBalance: vi.fn(async (): Promise<number> => 0),
    deriveBalances: vi.fn(async (): Promise<Map<string, number>> => new Map()),
    appendLedger: vi.fn(
      async (): Promise<{ ok: true } | { ok: false; duplicate: true }> => ({ ok: true }),
    ),
  };
});

vi.mock('../../src/lib/mongo-tx.js', () => ({
  withTransaction: vi.fn(
    async <T>(work: (session: undefined) => Promise<T>): Promise<T> => work(undefined),
  ),
}));

import { User } from '../../src/models/user.js';
import { MatchRecord } from '../../src/models/match-record.js';
import { Entitlement } from '../../src/models/entitlement.js';
import { CatalogItem } from '../../src/models/catalog-item.js';
import { WalletLedger } from '../../src/models/wallet-ledger.js';
import { appendLedger, isDuplicateKeyError } from '../../src/lib/wallet.js';
import { withTransaction } from '../../src/lib/mongo-tx.js';
import { XpEvent } from '../../src/economy/models/xp-event.js';
import { TitleProgress } from '../../src/economy/models/title-progress.js';
import { MatchReplay } from '../../src/economy/models/match-replay.js';
import {
  grantMatchRewards,
  GrantPayloadError,
  EARN_EVENTS_PER_HOUR,
  type GrantPlayerResult,
  type GrantSummary,
} from '../../src/economy/grant.js';
import { makeQuery } from '../helpers/harness.js';
import { xpThroughLevel } from '../../src/economy/levels.js';
import {
  ACCOUNT_IDS,
  ENDED_AT,
  MATCH_ID,
  ROOM_CODE,
  SEED,
  USER_ROWS,
  buildLog,
  buildRecord,
  duplicateKeyError,
} from './helpers/fixtures.js';

// ── capture sheets (re-reset each test; the unique-key sets are NOT —
//    duplicates across calls inside one test are the whole point) ─────────
interface UserRow {
  _id: string;
  nickname: string;
  xp: number;
  level: number;
  banned: boolean;
}

let appendCalls: Array<Record<string, unknown>> = [];
let userUpdates: Array<{ filter: unknown; update: Record<string, unknown> }> = [];
let titleUpserts: Array<{ filter: unknown; update: Record<string, unknown> }> = [];
let entitlementCreates: Array<Record<string, unknown>> = [];
let matchRecordCreates: Array<Record<string, unknown>> = [];
let matchReplayCreates: Array<Record<string, unknown>> = [];
let statsRows: Array<Record<string, unknown>> = [];
let ledgerCountResults: Record<string, number> = {};
let userRows: Record<string, UserRow> = {};
let entitlementError: Error | null = null;

// Persistence sets — lifted to module scope so tests can model Mongo-tx
// semantics: unique keys + (with withTxRollbackSemantics) rollback-on-throw.
// They are NOT part of resetSheets(): surviving across grant calls inside one
// test is the idempotence backbone.
let xpEventKeys = new Set<string>();
let matchRecordKeys = new Set<string>();
let matchReplayKeys = new Set<string>();
let ledgerTxIds = new Set<string>();
/** In-flight gate for XpEvent.create (key = `<accountId>:<matchId>`) — lets a
 * test hold two anchor inserts for the SAME key in flight simultaneously and
 * release them together, simulating two processes granting in parallel. */
let anchorGate: ((key: string) => Promise<void>) | null = null;

function resetSheets(): void {
  appendCalls = [];
  userUpdates = [];
  titleUpserts = [];
  entitlementCreates = [];
  matchRecordCreates = [];
  matchReplayCreates = [];
  statsRows = [];
  ledgerCountResults = {};
  userRows = { ...USER_ROWS };
  entitlementError = null;
}

/** The unit-test default: no session, no atomicity (sequential). */
function defaultTx(): void {
  vi.mocked(withTransaction).mockImplementation(
    (async <T>(work: (session: undefined) => Promise<T>): Promise<T> =>
      work(undefined)) as unknown as typeof withTransaction,
  );
}

/**
 * Model the REAL withTransaction semantics: writes made inside a tx are
 * visible to the caller (sheets), but on throw the tx ABORTS and every
 * persistence-set key it added rolls back — a mid-tx crash leaves NO anchor,
 * so a re-fire retries cleanly instead of reporting "already-granted".
 */
function withTxRollbackSemantics(): void {
  vi.mocked(withTransaction).mockImplementation(
    (async <T>(work: (session: undefined) => Promise<T>): Promise<T> => {
      const anchorsBefore = new Set(xpEventKeys);
      const ledgerBefore = new Set(ledgerTxIds);
      try {
        return await work(undefined);
      } catch (err) {
        for (const k of xpEventKeys) if (!anchorsBefore.has(k)) xpEventKeys.delete(k);
        for (const k of ledgerTxIds) if (!ledgerBefore.has(k)) ledgerTxIds.delete(k);
        throw err;
      }
    }) as unknown as typeof withTransaction,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  resetSheets();

  vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  vi.spyOn(console, 'error').mockImplementation(() => undefined);

  // MongoDB-shaped fakes: unique keys + E11000 on duplicates (the idempotency
  // backbone). Keys persist across calls within a test; sheets reset.
  xpEventKeys = new Set<string>();
  matchRecordKeys = new Set<string>();
  matchReplayKeys = new Set<string>();
  ledgerTxIds = new Set<string>();
  anchorGate = null;
  defaultTx(); // re-arm the plain sequential withTransaction for every test

  vi.mocked(User.findById).mockImplementation(
    ((id: unknown) =>
      makeQuery(id !== undefined && id !== null && userRows[String(id)] ? [userRows[String(id)]] : [], 'findOne')) as unknown as typeof User.findById,
  );

  vi.mocked(User.updateOne).mockImplementation(
    ((filter: unknown, update: Record<string, unknown>) => {
      userUpdates.push({ filter, update });
      return { exec: async () => ({ matchedCount: 1, upsertedCount: 0 }) };
    }) as unknown as typeof User.updateOne,
  );

  vi.mocked(MatchRecord.create).mockImplementation(
    ((docs: unknown) => {
      const doc = (Array.isArray(docs) ? docs[0] : docs) as Record<string, unknown>;
      const key = String(doc['matchId']);
      matchRecordCreates.push(doc);
      if (matchRecordKeys.has(key)) throw duplicateKeyError(key);
      matchRecordKeys.add(key);
      return [doc];
    }) as unknown as typeof MatchRecord.create,
  );

  vi.mocked(MatchReplay.create).mockImplementation(
    ((docs: unknown) => {
      const doc = (Array.isArray(docs) ? docs[0] : docs) as Record<string, unknown>;
      const key = String(doc['matchId']);
      matchReplayCreates.push(doc);
      if (matchReplayKeys.has(key)) throw duplicateKeyError(key);
      matchReplayKeys.add(key);
      return [doc];
    }) as unknown as typeof MatchReplay.create,
  );

  vi.mocked(XpEvent.create).mockImplementation(
    ((docs: unknown) => {
      const doc = (Array.isArray(docs) ? docs[0] : docs) as Record<string, unknown>;
      const key = `${String(doc['accountId'])}:${String(doc['matchId'])}`;
      // Always async + decide AFTER the optional gate: two in-flight inserts
      // for the same key must BOTH pass the pre-check — only one adds the key.
      const run = async (): Promise<unknown> => {
        await anchorGate?.(key);
        if (xpEventKeys.has(key)) throw duplicateKeyError(key);
        xpEventKeys.add(key);
        return [doc];
      };
      return run();
    }) as unknown as typeof XpEvent.create,
  );

  vi.mocked(appendLedger).mockImplementation(
    (async (input: Record<string, unknown>) => {
      const txId = String(input['txId']);
      // wallet_ledger's UNIQUE txId index — mirrored like the Mongo one:
      // a duplicate inserts NOTHING (the pre-existing row stays THE row).
      if (ledgerTxIds.has(txId)) return { ok: false, duplicate: true };
      ledgerTxIds.add(txId);
      appendCalls.push(input);
      return { ok: true };
    }) as unknown as typeof appendLedger,
  );

  vi.mocked(WalletLedger.countDocuments).mockImplementation(
    ((filter: Record<string, unknown>) => {
      const accountId = String(filter['accountId']);
      const counted = Number(ledgerCountResults[accountId] ?? 0);
      return { exec: async () => counted };
    }) as unknown as typeof WalletLedger.countDocuments,
  );

  // Stats rows answer PER ACCOUNT (the pipeline's $match id decides): the
  // caller of the eligible player only — everyone else sees no stats.
  vi.mocked(MatchRecord.aggregate).mockImplementation(
    ((pipeline: Array<Record<string, unknown>>) => ({
      session: vi.fn(),
      exec: async () => {
        const matchStage = pipeline[1] as Record<string, unknown> | undefined;
        const inMatch = matchStage?.['$match'] as Record<string, unknown> | undefined;
        const id = inMatch?.['players.accountId'];
        const row = statsRows.find((r) => String(r['_id']) === String(id));
        return row ? [row] : [];
      },
    })) as unknown as typeof MatchRecord.aggregate,
  );

  vi.mocked(TitleProgress.updateOne).mockImplementation(
    ((filter: unknown, update: Record<string, unknown>) => {
      titleUpserts.push({ filter, update });
      return { exec: async () => ({ matchedCount: 0, upsertedCount: 1 }) };
    }) as unknown as typeof TitleProgress.updateOne,
  );

  vi.mocked(CatalogItem.find).mockImplementation(
    (() => makeQuery([])) as unknown as typeof CatalogItem.find,
  );

  vi.mocked(Entitlement.create).mockImplementation(
    ((docs: unknown) => {
      const doc = (Array.isArray(docs) ? docs[0] : docs) as Record<string, unknown>;
      entitlementCreates.push(doc);
      if (entitlementError) throw entitlementError;
      return [doc];
    }) as unknown as typeof Entitlement.create,
  );
});

afterAll(() => {
  vi.restoreAllMocks();
});

type Payload = Parameters<typeof grantMatchRewards>[0];

function payload(overrides: Record<string, unknown> = {}): Payload {
  return {
    record: buildRecord(),
    roomCode: ROOM_CODE,
    seed: SEED,
    log: buildLog(),
    endedAt: ENDED_AT,
    ...overrides,
  } as unknown as Payload;
}

function playerOf(summary: GrantSummary, accountId: string): GrantPlayerResult {
  const row = summary.players.find((p) => p.accountId === accountId);
  expect(row).toBeDefined();
  return row as GrantPlayerResult;
}

// ─────────────────────────────────────────────────────────────────────────────

describe('contract fidelity — a realistic engine record end-to-end', () => {
  it('moves xp_events + ledger + users + match_records + match_replay_seeds together', async () => {
    const summary = await grantMatchRewards(payload());

    // Match-scoped persistence: exactly one doc per collection, mapped per STR/09.
    expect(summary.matchRecord).toBe('inserted');
    expect(summary.matchReplay).toBe('inserted');

    const recordDoc = matchRecordCreates[0] as Record<string, unknown>;
    expect(recordDoc['matchId']).toBe(MATCH_ID);
    expect(recordDoc['roomCode']).toBe(ROOM_CODE);
    expect(recordDoc['capacity']).toBe(5);
    expect(recordDoc['theme']).toBe('saloon');
    expect(recordDoc['startedAt']).toEqual(new Date(ENDED_AT.getTime() - 600_000));
    expect(recordDoc['endedAt']).toEqual(ENDED_AT);
    expect(recordDoc['summary']).toEqual({
      rounds: 3,
      totalPulls: 4,
      dareDevilMoments: 1,
    });
    const players = recordDoc['players'] as Array<Record<string, unknown>>;
    expect(players).toHaveLength(5);
    expect(players[0]).toMatchObject({
      seat: 0,
      nickname: 'Ron',
      titleAtPlay: 'sharp-eye',
      stats: {
        kills: 1,
        catches: 2,
        bluffSuccesses: 3,
        deaths: 0,
        roundsPlayed: 3,
        won: true,
        xpEarned: 12,
        coinsEarned: 8,
      },
    });

    const replayDoc = matchReplayCreates[0] as Record<string, unknown>;
    expect(replayDoc).toMatchObject({
      matchId: MATCH_ID,
      roomCode: ROOM_CODE,
      seed: SEED,
      winnerSeat: 0,
      aborted: false,
      endedAt: ENDED_AT,
    });
    expect(replayDoc['log']).toEqual(buildLog());

    // 5 rostered, 1 banned → 4 anchors, 4 ledger rows, 4 user updates, 4 txs.
    expect(vi.mocked(XpEvent.create)).toHaveBeenCalledTimes(4);
    expect(appendCalls).toHaveLength(4);
    expect(userUpdates).toHaveLength(4);
    expect(vi.mocked(withTransaction)).toHaveBeenCalledTimes(4);

    // The record's numbers are APPLIED verbatim (never recomputed), per user,
    // under reason 'match_reward' with txId match:<matchId>:<accountId>.
    const byAccount = new Map(
      appendCalls.map((c) => [String((c as Record<string, unknown>)['accountId']), c]),
    );
    expect(byAccount.get(ACCOUNT_IDS.winner)).toMatchObject({
      delta: 8,
      reason: 'match_reward',
      refId: MATCH_ID,
      txId: `match:${MATCH_ID}:${ACCOUNT_IDS.winner}`,
    });
    expect(byAccount.get(ACCOUNT_IDS.liar)).toMatchObject({ delta: 2 });
    expect(byAccount.get(ACCOUNT_IDS.survivor)).toMatchObject({ delta: 2 });
    // Leavers keep round coins (R1 ⑧/⑩): 1 round survived → 1 coin, 0 XP.
    expect(byAccount.get(ACCOUNT_IDS.leaver)).toMatchObject({ delta: 1 });
    expect(byAccount.get(ACCOUNT_IDS.banned)).toBeUndefined();
    expect(byAccount.get(ACCOUNT_IDS.ghost)).toBeUndefined();

    // users: XP applied from the record, level recomputed from the curve.
    const winnerUpdate = userUpdates.find(
      (u) => String((u.filter as Record<string, unknown>)['_id']) === ACCOUNT_IDS.winner,
    )?.update;
    expect(winnerUpdate).toMatchObject({ $set: { level: 1 }, $inc: { xp: 12 } });
    const liarUpdate = userUpdates.find(
      (u) => String((u.filter as Record<string, unknown>)['_id']) === ACCOUNT_IDS.liar,
    )?.update;
    expect(liarUpdate).toMatchObject({ $inc: { xp: 4 } }); // 721 + 4 → still level 1
    const leaverUpdate = userUpdates.find(
      (u) => String((u.filter as Record<string, unknown>)['_id']) === ACCOUNT_IDS.leaver,
    )?.update;
    expect(leaverUpdate).toMatchObject({ $set: { level: 1 } });
    expect(leaverUpdate?.['$inc']).toBeUndefined(); // 0 XP → no $inc at all

    // No titles unlock from empty cumulative stats, no items from level 1.
    expect(titleUpserts).toHaveLength(0);
    expect(entitlementCreates).toHaveLength(0);

    expect(playerOf(summary, ACCOUNT_IDS.winner)).toMatchObject({
      status: 'granted',
      xpCredited: 12,
      coinsCredited: 8,
      coinsCapped: false,
      level: 1,
    });
  });

  it('skips players with no (or invalid) accountId and unknown users, loudly', async () => {
    const record = buildRecord();
    const noAccount = record.players[1];
    if (noAccount) noAccount.accountId = undefined;
    const invalidId = record.players[2];
    if (invalidId) invalidId.accountId = 'not-an-objectid';

    const summary = await grantMatchRewards(payload({ record }));
    expect(summary.players[1]?.status).toBe('skipped-no-account');
    expect(summary.players[1]?.accountId).toBeNull();
    expect(summary.players[2]?.status).toBe('skipped-no-account');

    const warned = JSON.stringify(vi.mocked(console.warn).mock.calls);
    expect(warned).toContain('no account');

    // valid-shaped id missing from users → unknown-user skip, no writes.
    const record2 = buildRecord();
    const ghostSeat = record2.players[3];
    if (ghostSeat) ghostSeat.accountId = ACCOUNT_IDS.ghost;
    const summary2 = await grantMatchRewards(payload({ record: record2 }));
    expect(summary2.players[3]?.status).toBe('skipped-unknown-user');
    expect(
      appendCalls.find((c) => String(c['accountId']) === ACCOUNT_IDS.ghost),
    ).toBeUndefined();
    expect(
      userUpdates.find(
        (u) => String((u.filter as Record<string, unknown>)['_id']) === ACCOUNT_IDS.ghost,
      ),
    ).toBeUndefined();
  });
});

describe('idempotence — a double-fired game:over is a no-op, not an error', () => {
  it('second grant of the same match: anchors reject → already-granted, zero new writes', async () => {
    const input = payload();
    const first = await grantMatchRewards(input);
    expect(first.players.filter((p) => p.status === 'granted')).toHaveLength(4);

    resetSheets();

    const second = await grantMatchRewards(input);

    expect(second.matchRecord).toBe('already-present');
    expect(second.matchReplay).toBe('already-present');
    // Match-record insert attempted but tolerated (duplicate = already done)…
    expect(matchRecordCreates).toHaveLength(1);
    expect(matchReplayCreates).toHaveLength(1);
    // …but NO further economy writes at all:
    expect(appendCalls).toHaveLength(0);
    expect(userUpdates).toHaveLength(0);
    expect(titleUpserts).toHaveLength(0);
    expect(entitlementCreates).toHaveLength(0);
    for (const player of second.players) {
      expect(player.status).toBe(
        player.accountId === ACCOUNT_IDS.banned ? 'skipped-banned' : 'already-granted',
      );
      expect(player.xpCredited).toBe(0);
      expect(player.coinsCredited).toBe(0);
    }
  });

  it('concurrent-grant race: a duplicate anchor for one user leaves the other grants intact', async () => {
    // winner is processed first (seat 0) — one-shot dup on the anchor create.
    vi.mocked(XpEvent.create).mockImplementationOnce(
      (() => {
        throw duplicateKeyError(`${ACCOUNT_IDS.winner}:${MATCH_ID}`);
      }) as unknown as typeof XpEvent.create,
    );

    const summary = await grantMatchRewards(payload());

    const winner = playerOf(summary, ACCOUNT_IDS.winner);
    expect(winner.status).toBe('already-granted');
    expect(winner.xpCredited).toBe(0);
    expect(
      appendCalls.find((c) => String(c['accountId']) === ACCOUNT_IDS.winner),
    ).toBeUndefined();
    expect(
      userUpdates.find(
        (u) => String((u.filter as Record<string, unknown>)['_id']) === ACCOUNT_IDS.winner,
      ),
    ).toBeUndefined();
    // Everyone else granted normally.
    expect(summary.players.filter((p) => p.status === 'granted')).toHaveLength(3);
  });
});

describe('banned users never get anything', () => {
  it('log-skips the banned player — no anchor, no coins, no XP, no titles', async () => {
    const summary = await grantMatchRewards(payload());
    const banned = playerOf(summary, ACCOUNT_IDS.banned);
    expect(banned.status).toBe('skipped-banned');
    expect(banned.xpCredited).toBe(0);
    expect(banned.coinsCredited).toBe(0);
    expect(
      appendCalls.find((c) => String(c['accountId']) === ACCOUNT_IDS.banned),
    ).toBeUndefined();
    expect(vi.mocked(console.warn).mock.calls.flat().join(' ')).toContain('banned');
  });

  it('re-checks the ban inside the tx — matchedCount 0 backstops a mid-flight ban', async () => {
    vi.mocked(User.updateOne).mockImplementation(
      ((filter: unknown, update: Record<string, unknown>) => {
        const id = String((filter as Record<string, unknown>)['_id']);
        const matched = id === ACCOUNT_IDS.winner ? 0 : 1;
        if (matched === 1) userUpdates.push({ filter, update });
        return { exec: async () => ({ matchedCount: matched, upsertedCount: 0 }) };
      }) as unknown as typeof User.updateOne,
    );
    const summary = await grantMatchRewards(payload());
    expect(playerOf(summary, ACCOUNT_IDS.winner).status).toBe('skipped-banned');
    expect(
      appendCalls.find((c) => String(c['accountId']) === ACCOUNT_IDS.winner),
    ).toBeUndefined();
    expect(summary.players.filter((p) => p.status === 'granted')).toHaveLength(3);
  });
});

describe('anti-farm cap (STR/04 §2 — 3 earn-events/hour/user)', () => {
  it('withholds the coins but still grants XP; the anchor is still written (re-fire safe)', async () => {
    ledgerCountResults = { [ACCOUNT_IDS.winner]: EARN_EVENTS_PER_HOUR };

    const summary = await grantMatchRewards(payload());
    const winner = playerOf(summary, ACCOUNT_IDS.winner);
    expect(winner.coinsCapped).toBe(true);
    expect(winner.coinsCredited).toBe(0);
    expect(winner.xpCredited).toBe(12); // the cap lives under "Earning coins" only
    expect(
      appendCalls.find((c) => String(c['accountId']) === ACCOUNT_IDS.winner),
    ).toBeUndefined();
    expect(
      userUpdates.find(
        (u) => String((u.filter as Record<string, unknown>)['_id']) === ACCOUNT_IDS.winner,
      )?.update,
    ).toMatchObject({ $inc: { xp: 12 } });
    // Other players unaffected.
    expect(appendCalls).toHaveLength(3);
    expect(vi.mocked(WalletLedger.countDocuments).mock.calls[0]?.[0]).toMatchObject({
      reason: 'match_reward',
    });

    // The cap counted only the last rolling hour (at >= endedAt − 1h).
    const capFilter = vi.mocked(WalletLedger.countDocuments).mock
      .calls[0]?.[0] as unknown as Record<string, unknown>;
    const since = (capFilter['at'] as Record<string, unknown>)['$gte'] as Date;
    expect(since).toEqual(new Date(ENDED_AT.getTime() - 60 * 60 * 1000));
  });

  it('holds at 3 in-hour earn events: the next grant at count 3 caps', () => {
    expect(EARN_EVENTS_PER_HOUR).toBe(3);
  });
});

describe('title unlocks (stored + recomputed on grant)', () => {
  it('upserts every newly-unlocked title with progress, in table order', async () => {
    statsRows = [
      {
        _id: ACCOUNT_IDS.winner,
        matches: 50,
        wins: 10,
        kills: 25,
        catches: 100,
        falseAccusations: 1,
        bluffSuccesses: 100,
        pullsSurvived: 9,
      },
    ];
    const summary = await grantMatchRewards(payload());
    const winner = playerOf(summary, ACCOUNT_IDS.winner);
    expect(winner.unlockedTitles).toEqual([
      'best-liar',
      'smooth-talker',
      'sharp-eye',
      'lie-detector',
      'dead-eye',
      'grim-reaper',
      'bar-legend',
      'regular',
      'cat-with-nine-lives',
      'chicken-dinner',
    ]);
    expect(titleUpserts).toHaveLength(10);
    const progressRow = titleUpserts.find(
      (t) => (t.filter as Record<string, unknown>)['titleId'] === 'regular',
    );
    expect(progressRow?.update['$setOnInsert']).toMatchObject({
      unlockedAt: ENDED_AT,
      progress: 50,
    });
    // Storage idempotence: the (accountId, titleId) unique upsert.
    expect(progressRow?.filter).toMatchObject({ titleId: 'regular' });
  });

  it('already-stored titles stay recomputed but are not reported as new', async () => {
    vi.mocked(TitleProgress.updateOne).mockImplementation(
      ((filter: unknown, update: Record<string, unknown>) => {
        titleUpserts.push({ filter, update });
        return { exec: async () => ({ matchedCount: 1, upsertedCount: 0 }) };
      }) as unknown as typeof TitleProgress.updateOne,
    );
    statsRows = [
      {
        _id: ACCOUNT_IDS.winner,
        matches: 0,
        wins: 0,
        kills: 0,
        catches: 25,
        falseAccusations: 0,
        bluffSuccesses: 0,
        pullsSurvived: 0,
      },
    ];
    const summary = await grantMatchRewards(payload());
    expect(titleUpserts).toHaveLength(1); // sharp-eye recomputed — already earned
    expect(playerOf(summary, ACCOUNT_IDS.winner).unlockedTitles).toEqual([]);
  });
});

describe('earned-only level-locked items (prestige frames, STR/04 §5)', () => {
  it('grants the catalog frame when the grant levels a player to its levelReq', async () => {
    userRows = {
      ...USER_ROWS,
      [ACCOUNT_IDS.winner]: {
        _id: ACCOUNT_IDS.winner,
        nickname: 'Ron',
        xp: 8850,
        level: 9,
        banned: false,
      },
    };
    vi.mocked(CatalogItem.find).mockImplementation(
      (() =>
        makeQuery([
          {
            _id: 'frame:prestige-bronze',
            category: 'frame',
            name: 'Prestige Bronze',
            price: 250,
            free: false,
            active: true,
            levelReq: 10,
            sort: 5,
          },
        ])) as unknown as typeof CatalogItem.find,
    );

    const summary = await grantMatchRewards(payload());
    const winner = playerOf(summary, ACCOUNT_IDS.winner);
    // 8850 + 12 = 8862 ≥ xpThroughLevel(10) = 8856 → level 10, levelUp, frame.
    expect(winner.level).toBe(10);
    expect(winner.levelUp).toBe(true);
    expect(winner.unlockedItems).toEqual(['frame:prestige-bronze']);
    expect(vi.mocked(CatalogItem.find)).toHaveBeenCalledWith({
      active: true,
      levelReq: { $gt: 0, $lte: 10 },
    });
    const created = entitlementCreates[0] as Record<string, unknown>;
    expect(String(created['accountId'])).toBe(ACCOUNT_IDS.winner);
    expect(created['kind']).toBe('item');
    expect(created['key']).toBe('prestige-bronze'); // shop's canonical slug
    expect(created['source']).toBe('level'); // earned-only, never purchasable
  });

  it('treats an already-earned entitlement as fine (duplicate key ignored)', async () => {
    userRows = {
      ...USER_ROWS,
      [ACCOUNT_IDS.winner]: {
        _id: ACCOUNT_IDS.winner,
        nickname: 'Ron',
        xp: 8850,
        level: 9,
        banned: false,
      },
    };
    entitlementError = duplicateKeyError('entitlement');
    vi.mocked(CatalogItem.find).mockImplementation(
      (() =>
        makeQuery([
          { _id: 'frame:prestige-bronze', category: 'frame', levelReq: 10, active: true },
        ])) as unknown as typeof CatalogItem.find,
    );
    const summary = await grantMatchRewards(payload());
    expect(playerOf(summary, ACCOUNT_IDS.winner).status).toBe('granted');
    expect(playerOf(summary, ACCOUNT_IDS.winner).unlockedItems).toEqual([]);
  });
});

describe('payload zod (defensive module-boundary validation)', () => {
  function badPayloads(): Array<[string, Payload]> {
    const noMatchId = buildRecord();
    noMatchId.matchId = undefined;

    const badCoins = buildRecord();
    const first = badCoins.players[0];
    const second = badCoins.players[1];
    if (first && second) {
      first.stats.coinsEarned = -1; // engine never emits negatives
      badCoins.players = [first, second];
    }

    const solo = buildRecord();
    const only = solo.players[0];
    if (only) solo.players = [only];

    return [
      ['missing matchId', payload({ record: noMatchId })],
      ['negative coinsEarned', payload({ record: badCoins })],
      ['one player only', payload({ record: solo })],
      ['log entry without event', payload({ log: [{ seq: 0, accepted: true }] })],
      ['endedAt as string', payload({ endedAt: '2026-11-23T21:30:00.000Z' })],
      ['negative seed', payload({ seed: -1 })],
    ];
  }

  for (const [label, bad] of badPayloads()) {
    it(`rejects ${label} with GrantPayloadError and writes NOTHING`, async () => {
      await expect(grantMatchRewards(bad)).rejects.toBeInstanceOf(GrantPayloadError);
      expect(matchRecordCreates).toHaveLength(0);
      expect(matchReplayCreates).toHaveLength(0);
      expect(vi.mocked(XpEvent.create)).not.toHaveBeenCalled();
      expect(appendCalls).toHaveLength(0);
      expect(userUpdates).toHaveLength(0);
      expect(vi.mocked(withTransaction)).not.toHaveBeenCalled();
    });
  }
});

describe('helpers stay honest', () => {
  it('isDuplicateKeyError recognizes E11000', () => {
    expect(isDuplicateKeyError(duplicateKeyError('x'))).toBe(true);
    expect(isDuplicateKeyError(new Error('plain'))).toBe(false);
    expect(isDuplicateKeyError({ code: 11000 })).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// A8 edge audit — adversarial edge cases over the money + progression path
// ─────────────────────────────────────────────────────────────────────────────

describe('A8 — mid-flight ban must not poison the anchor', () => {
  it('matchedCount 0 ABORTS the tx: anchor rolled back, re-grant after unban recovers', async () => {
    withTxRollbackSemantics();
    let withholdWinner = true;
    vi.mocked(User.updateOne).mockImplementation(
      ((filter: unknown, update: Record<string, unknown>) => {
        const id = String((filter as Record<string, unknown>)['_id']);
        if (id === ACCOUNT_IDS.winner && withholdWinner) {
          // Ban landed between findById and the tx's users update.
          return { exec: async () => ({ matchedCount: 0, upsertedCount: 0 }) };
        }
        userUpdates.push({ filter, update });
        return { exec: async () => ({ matchedCount: 1, upsertedCount: 0 }) };
      }) as unknown as typeof User.updateOne,
    );

    const first = await grantMatchRewards(payload());
    expect(playerOf(first, ACCOUNT_IDS.winner).status).toBe('skipped-banned');
    expect(first.players.filter((p) => p.status === 'granted')).toHaveLength(3);
    // Anchor was attempted (tx's first write) but did NOT survive the abort:
    expect(xpEventKeys.has(`${ACCOUNT_IDS.winner}:${MATCH_ID}`)).toBe(false);
    expect(xpEventKeys.has(`${ACCOUNT_IDS.liar}:${MATCH_ID}`)).toBe(true);
    expect(
      appendCalls.find((c) => String(c['accountId']) === ACCOUNT_IDS.winner),
    ).toBeUndefined();
    expect(vi.mocked(console.warn).mock.calls.flat().join(' ')).toContain('mid-flight');

    // Re-fire after the (hypothetical) unban: the pre-fix code hit the leaked
    // anchor and returned 'already-granted' — the player's reward was gone
    // forever. Now the grant retries and completes.
    withholdWinner = false;
    const second = await grantMatchRewards(payload());
    expect(playerOf(second, ACCOUNT_IDS.winner).status).toBe('granted');
    expect(playerOf(second, ACCOUNT_IDS.liar).status).toBe('already-granted');
    const winnerUpdates = userUpdates.filter(
      (u) => String((u.filter as Record<string, unknown>)['_id']) === ACCOUNT_IDS.winner,
    );
    expect(winnerUpdates).toHaveLength(1); // exactly one XP application ever
    expect(winnerUpdates[0]?.update).toMatchObject({ $inc: { xp: 12 } });
    expect(appendCalls.filter((c) => String(c['accountId']) === ACCOUNT_IDS.winner)).toHaveLength(1);
  });
});

describe('A8 — roster partial failure retries clean (the tx guarantees)', () => {
  it('a mid-roster crash rejects the whole call; re-fire loses nothing, doubles nothing', async () => {
    withTxRollbackSemantics();
    let crashLiar = true;
    vi.mocked(User.updateOne).mockImplementation(
      ((filter: unknown, update: Record<string, unknown>) => {
        const id = String((filter as Record<string, unknown>)['_id']);
        if (id === ACCOUNT_IDS.liar && crashLiar) {
          return {
            exec: async () => {
              throw new Error('mongo write failure (simulated mid-tx crash)');
            },
          };
        }
        userUpdates.push({ filter, update });
        return { exec: async () => ({ matchedCount: 1, upsertedCount: 0 }) };
      }) as unknown as typeof User.updateOne,
    );

    await expect(grantMatchRewards(payload())).rejects.toThrow('mongo write failure');
    // Winner (seat 0) already fully committed in its own tx; liar's anchor died with its tx.
    expect(xpEventKeys.has(`${ACCOUNT_IDS.winner}:${MATCH_ID}`)).toBe(true);
    expect(xpEventKeys.has(`${ACCOUNT_IDS.liar}:${MATCH_ID}`)).toBe(false);
    expect(appendCalls.filter((c) => String(c['accountId']) === ACCOUNT_IDS.winner)).toHaveLength(1);

    crashLiar = false;
    const second = await grantMatchRewards(payload());
    expect(second.matchRecord).toBe('already-present');
    expect(second.matchReplay).toBe('already-present');
    expect(playerOf(second, ACCOUNT_IDS.winner).status).toBe('already-granted');
    expect(playerOf(second, ACCOUNT_IDS.liar).status).toBe('granted'); // retried clean
    const liarUpdates = userUpdates.filter(
      (u) => String((u.filter as Record<string, unknown>)['_id']) === ACCOUNT_IDS.liar,
    );
    expect(liarUpdates).toHaveLength(1);
    expect(appendCalls.filter((c) => String(c['accountId']) === ACCOUNT_IDS.liar)).toHaveLength(1);
    expect(appendCalls.filter((c) => String(c['accountId']) === ACCOUNT_IDS.winner)).toHaveLength(1);
  });
});

describe('A8 — two process-parallel re-fires of the same game:over', () => {
  it('exactly one grant per player: {granted, already-granted}, one row, one update', async () => {
    let winnerArrivals = 0;
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    anchorGate = (key) => {
      if (key.startsWith(`${ACCOUNT_IDS.winner}:`)) {
        winnerArrivals += 1;
        if (winnerArrivals === 2) release(); // both anchors in flight together
        return gate;
      }
      return Promise.resolve();
    };

    const both = await Promise.all([
      grantMatchRewards(payload()),
      grantMatchRewards(payload()),
    ]);
    const [a, b] = both;

    // Match-scoped persistence: one insert, one tolerated duplicate — same doc.
    expect([a.matchRecord, b.matchRecord].sort()).toEqual(['already-present', 'inserted']);
    expect([a.matchReplay, b.matchReplay].sort()).toEqual(['already-present', 'inserted']);
    expect(matchReplayCreates).toHaveLength(2); // both attempted; one E11000'd

    for (const id of [
      ACCOUNT_IDS.winner,
      ACCOUNT_IDS.liar,
      ACCOUNT_IDS.survivor,
      ACCOUNT_IDS.leaver,
    ]) {
      expect([playerOf(a, id).status, playerOf(b, id).status].sort()).toEqual([
        'already-granted',
        'granted',
      ]);
      expect(appendCalls.filter((c) => String(c['accountId']) === id)).toHaveLength(1);
      expect(
        userUpdates.filter(
          (u) => String((u.filter as Record<string, unknown>)['_id']) === id,
        ),
      ).toHaveLength(1);
    }
    expect(xpEventKeys.size).toBe(4); // one anchor per granted player, no more
    expect(userUpdates).toHaveLength(4);
    expect(playerOf(a, ACCOUNT_IDS.banned).status).toBe('skipped-banned');
    expect(playerOf(b, ACCOUNT_IDS.banned).status).toBe('skipped-banned');
  });
});

describe('A8 — deliberate partial wallet state (ledger row exists, anchor lost)', () => {
  it('txId duplicate after a fresh anchor is swallowed, not an error; no second row', async () => {
    ledgerTxIds.add(`match:${MATCH_ID}:${ACCOUNT_IDS.winner}`);
    const summary = await grantMatchRewards(payload());
    const winner = playerOf(summary, ACCOUNT_IDS.winner);
    expect(winner.status).toBe('granted');
    expect(winner.coinsCredited).toBe(8); // treat-as-credited (the committed identical key)
    expect(winner.coinsCapped).toBe(false);
    expect(
      appendCalls.filter((c) => String(c['accountId']) === ACCOUNT_IDS.winner),
    ).toHaveLength(0); // the seeded row IS the row — duplicate inserted nothing
    expect(xpEventKeys.has(`${ACCOUNT_IDS.winner}:${MATCH_ID}`)).toBe(true);
    // Everyone else granted normally despite the odd wallet state.
    expect(summary.players.filter((p) => p.status === 'granted')).toHaveLength(4);
  });
});

describe('A8 — anti-farm cap boundary (3rd event ok, 4th withheld)', () => {
  it('two prior events in the window: this grant still credits (count 2 < cap 3)', async () => {
    ledgerCountResults = { [ACCOUNT_IDS.winner]: EARN_EVENTS_PER_HOUR - 1 };
    const summary = await grantMatchRewards(payload());
    const winner = playerOf(summary, ACCOUNT_IDS.winner);
    expect(winner.coinsCapped).toBe(false);
    expect(winner.coinsCredited).toBe(8);
    expect(
      appendCalls.filter((c) => String(c['accountId']) === ACCOUNT_IDS.winner),
    ).toHaveLength(1);
  });

  it('re-fire after a capped grant never counts toward the cap again', async () => {
    ledgerCountResults = { [ACCOUNT_IDS.winner]: EARN_EVENTS_PER_HOUR };
    await grantMatchRewards(payload());
    resetSheets();
    const capReadsBefore = vi.mocked(WalletLedger.countDocuments).mock.calls.length;

    const second = await grantMatchRewards(payload());
    const winnerRow = playerOf(second, ACCOUNT_IDS.winner);
    expect(winnerRow.status).toBe('already-granted'); // anchor dup short-circuits before any cap read
    expect(winnerRow.coinsCredited).toBe(0);
    expect(winnerRow.coinsCapped).toBe(false); // pin: the no-op call reports no withholding
    expect(vi.mocked(WalletLedger.countDocuments).mock.calls.length).toBe(capReadsBefore);
    expect(appendCalls).toHaveLength(0); // the capped match itself also wrote no row
  });
});

describe('A8 — zero-round abort (summary.rounds = 0)', () => {
  it('persists record + replay, divides nothing, grants XP-0/coins-0 cleanly', async () => {
    const roster = buildRecord().players.map((p) => ({
      ...p,
      stats: {
        kills: 0,
        catches: 0,
        falseAccusations: 0,
        bluffSuccesses: 0,
        deaths: 0,
        deathCause: undefined,
        pullsSurvived: 0,
        roundsPlayed: 0,
        roundsSurvived: 0,
        won: false,
        xpEarned: 0,
        coinsEarned: 0,
      },
    }));
    const abortedRecord = buildRecord({
      summary: { rounds: 0, totalPulls: 0, dareDevilMoments: 0 },
      aborted: true,
      winnerSeat: null,
      players: roster,
    });

    const summary = await grantMatchRewards(payload({ record: abortedRecord }));

    expect(summary.matchRecord).toBe('inserted');
    expect(summary.matchReplay).toBe('inserted');
    expect(matchReplayCreates[0]).toMatchObject({ aborted: true, winnerSeat: null });
    expect(matchRecordCreates[0]?.['summary']).toEqual({
      rounds: 0,
      totalPulls: 0,
      dareDevilMoments: 0,
    });
    expect(appendCalls).toHaveLength(0); // zero coins → zero ledger rows
    expect(summary.players.filter((p) => p.status === 'granted')).toHaveLength(4);
    for (const p of summary.players) {
      expect(p.xpCredited).toBe(0);
      expect(p.coinsCredited).toBe(0);
      expect(p.levelUp).toBe(false);
      expect(p.level).toBe(1);
    }
    // xp 0 → the users update is exactly a level re-set, never an $inc.
    for (const u of userUpdates) {
      expect(u.update['$inc']).toBeUndefined();
      expect(u.update['$set']).toMatchObject({ level: 1 });
    }
    // The anchor is still written for every rostered human — re-fire stays a no-op.
    expect(vi.mocked(XpEvent.create)).toHaveBeenCalledTimes(4);
  });
});

describe('A8 — all-bot rosters', () => {
  it('unknown accounts: match_records + replay persist; every player skipped-unknown-user', async () => {
    const record = buildRecord();
    for (const p of record.players) p.accountId = ACCOUNT_IDS.ghost;

    const summary = await grantMatchRewards(payload({ record }));

    expect(summary.matchRecord).toBe('inserted');
    expect(summary.matchReplay).toBe('inserted');
    expect(matchReplayCreates[0]).toMatchObject({ seed: SEED, matchId: MATCH_ID });
    // The match DID happen — all five zero-unknown seats keep their stats rows.
    expect(matchRecordCreates[0]?.['players']).toHaveLength(5);
    expect(summary.players.every((p) => p.status === 'skipped-unknown-user')).toBe(true);
    expect(appendCalls).toHaveLength(0);
    expect(userUpdates).toHaveLength(0);
    expect(vi.mocked(withTransaction)).not.toHaveBeenCalled();
  });

  it('accountId-less seats persist an empty players array — coherent, no half-writes', async () => {
    const record = buildRecord();
    for (const p of record.players) p.accountId = undefined;

    const summary = await grantMatchRewards(payload({ record }));

    expect(summary.matchRecord).toBe('inserted');
    expect(summary.matchReplay).toBe('inserted');
    expect(matchRecordCreates[0]?.['players']).toEqual([]); // every seat dropped
    expect(summary.players.every((p) => p.status === 'skipped-no-account')).toBe(true);
    expect(appendCalls).toHaveLength(0);
  });
});

describe('A8 — prestige frames at exact milestones (10/20/30/40)', () => {
  function withWinnerAt(xp: number, level: number): void {
    userRows = {
      ...USER_ROWS,
      [ACCOUNT_IDS.winner]: {
        _id: ACCOUNT_IDS.winner,
        nickname: 'Ron',
        xp,
        level,
        banned: false,
      },
    };
  }

  it('grants level 20 EXACTLY with this match (xpThroughLevel(20) boundary)', async () => {
    withWinnerAt(xpThroughLevel(20) - 12, 19); // record's 12 XP lands on the line
    vi.mocked(CatalogItem.find).mockImplementation(
      (() =>
        makeQuery([
          { _id: 'frame:prestige-bronze', category: 'frame', levelReq: 10, active: true },
          { _id: 'frame:prestige-silver', category: 'frame', levelReq: 20, active: true },
        ])) as unknown as typeof CatalogItem.find,
    );

    const summary = await grantMatchRewards(payload());
    const winner = playerOf(summary, ACCOUNT_IDS.winner);
    expect(winner.level).toBe(20);
    expect(winner.levelUp).toBe(true);
    expect(vi.mocked(CatalogItem.find)).toHaveBeenCalledWith({
      active: true,
      levelReq: { $gt: 0, $lte: 20 },
    });
    expect(winner.unlockedItems.slice().sort()).toEqual([
      'frame:prestige-bronze',
      'frame:prestige-silver',
    ]);
    const created = new Map(entitlementCreates.map((c) => [String(c['key']), c]));
    expect(created.get('prestige-silver')).toMatchObject({ kind: 'item', source: 'level' });
    expect(created.get('prestige-bronze')).toMatchObject({ kind: 'item', source: 'level' });
    // $lte (not $lt): levelReq 20 is included AT level 20.
    expect(String((userUpdates[0]?.update['$set'] as Record<string, unknown>)['level'])).toBe('20');
  });

  it('backfills every previously crossed milestone on ANY later grant (late catalog seed)', async () => {
    withWinnerAt(xpThroughLevel(40), 40); // already 40 — frames 10/20/30/40 owed
    vi.mocked(CatalogItem.find).mockImplementation(
      (() =>
        makeQuery([
          { _id: 'frame:prestige-bronze', category: 'frame', levelReq: 10, active: true },
          { _id: 'frame:prestige-silver', category: 'frame', levelReq: 20, active: true },
          { _id: 'frame:prestige-gold', category: 'frame', levelReq: 30, active: true },
          { _id: 'frame:prestige-diamond', category: 'frame', levelReq: 40, active: true },
        ])) as unknown as typeof CatalogItem.find,
    );

    const summary = await grantMatchRewards(payload());
    const winner = playerOf(summary, ACCOUNT_IDS.winner);
    expect(winner.level).toBe(40);
    expect(winner.levelUp).toBe(false);
    expect(winner.unlockedItems).toHaveLength(4); // all four in ONE grant
    const winnerEntitlements = entitlementCreates.filter(
      (c) => String(c['accountId']) === ACCOUNT_IDS.winner,
    );
    expect(winnerEntitlements).toHaveLength(4); // every other grantee earns theirs too
    for (const doc of winnerEntitlements) {
      expect(doc['source']).toBe('level'); // earned-only, never purchasable
      expect(doc['kind']).toBe('item');
    }

    // Re-fire is a no-op — no duplicate entitlement attempt even begins.
    resetSheets();
    const second = await grantMatchRewards(payload());
    expect(playerOf(second, ACCOUNT_IDS.winner).status).toBe('already-granted');
    expect(playerOf(second, ACCOUNT_IDS.winner).unlockedItems).toEqual([]);
    expect(entitlementCreates).toHaveLength(0);
  });
});
