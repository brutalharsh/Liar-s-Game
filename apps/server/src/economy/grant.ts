/**
 * grantMatchRewards — THE economy seam the game layer calls at `game:over`
 * (STR/04 §2/§5/§6, STR/09). One call, whole roster:
 *
 *  1. persist ONE match_records doc (record per STR/09 — stats core only,
 *     `S-A1's model) + the replay envelope (seed/log/winnerSeat/aborted →
 *     match_replay_seeds, keyed by the same matchId). Both tolerate
 *     duplicate-key = already persisted.
 *  2. per roster player, inside ONE Mongo transaction each:
 *     xp_events row FIRST (unique accountId+matchId — the idempotence
 *     anchor; duplicate key = this player's grant already fully committed
 *     → no-op), then users update (+xp, recomputed level), ledger row
 *     (txId `match:<matchId>:<userId>`, reason 'match_reward'), title
 *     unlocks (recomputed from match_records aggregation), and earned-only
 *     level-locked catalog items (prestige frames at 10/20/30/40).
 *
 * The rules engine is the source of truth for every number: record.stats
 * .xpEarned/.coinsEarned are APPLIED, never recomputed. Banned users are
 * log-skipped with no grant. The winner's randInt(2..7) already lives in
 * the record's coinsEarned. Anti-farm: STR/04 §2 caps coin earn-events at
 * 3 per user per rolling hour (XP is unaffected — the cap lives under
 * "Earning coins"); txId/xp_event uniqueness blocks replays.
 *
 * Contract (S1 types its side identically):
 *   grantMatchRewards({ record: MatchRecord /* rules-engine *\/, roomCode,
 *                      seed: number, log: LogEntry[] /* rules-engine *\/,
 *                      endedAt: Date })
 */
import { z } from 'zod';
import mongoose, { type ClientSession } from 'mongoose';
import type { LogEntry, MatchRecord } from '@liars-game/rules-engine';
import { withTransaction } from '../lib/mongo-tx.js';
import { appendLedger, isDuplicateKeyError } from '../lib/wallet.js';
import { CatalogItem } from '../models/catalog-item.js';
import { Entitlement } from '../models/entitlement.js';
import { MatchRecord as MatchRecordModel, type MatchRecordFields } from '../models/match-record.js';
import { User } from '../models/user.js';
import { WalletLedger } from '../models/wallet-ledger.js';
import { MatchReplay } from './models/match-replay.js';
import { TitleProgress } from './models/title-progress.js';
import { XpEvent } from './models/xp-event.js';
import { computeLevel } from './levels.js';
import { computeUnlockedTitles, type CumulativeStats } from './titles.js';

/** STR/04 §2 — max coin earn-events per user per rolling hour. */
export const EARN_EVENTS_PER_HOUR = 3;
export const EARN_WINDOW_MS = 60 * 60 * 1000;

// ─────────────────────────────────────────────────────────────────────────────
// Payload contract (S1 → economy) + defensive zod (module boundary)
// ─────────────────────────────────────────────────────────────────────────────

export interface GrantMatchRewardsPayload {
  record: MatchRecord;
  roomCode: string;
  seed: number;
  log: LogEntry[];
  endedAt: Date;
}

const PlayerStatsSchema = z.strictObject({
  kills: z.number().int().min(0).max(100_000),
  catches: z.number().int().min(0).max(100_000),
  falseAccusations: z.number().int().min(0).max(100_000),
  bluffSuccesses: z.number().int().min(0).max(100_000),
  deaths: z.number().int().min(0).max(10),
  deathCause: z.enum(['selfRoulette', 'executed']).optional(),
  pullsSurvived: z.number().int().min(0).max(100_000),
  roundsPlayed: z.number().int().min(0).max(100_000),
  roundsSurvived: z.number().int().min(0).max(100_000),
  won: z.boolean(),
  xpEarned: z.number().int().min(0).max(10_000),
  coinsEarned: z.number().int().min(0).max(100_000),
});

/** Loose on `event` (engine union, R1's contract) — the log is stored opaque. */
const LogEntrySchema = z.looseObject({
  seq: z.number().int().min(0),
  event: z.looseObject({ type: z.string().min(1).max(32) }),
  accepted: z.boolean(),
});

/** Mirrors the engine's MatchRecord exactly (types.ts) — strict, so API drift is loud. */
const GrantPayloadSchema = z.strictObject({
  record: z.strictObject({
    matchId: z.string().min(1).max(64),
    roomCode: z.string().min(1).max(16).optional(),
    startedAt: z.number().int().min(0).max(8.64e15).optional(),
    endedAt: z.number().int().min(0).max(8.64e15).optional(),
    capacity: z.number().int().min(2).max(10),
    theme: z.string().min(1).max(64).optional(),
    players: z
      .array(
        z.strictObject({
          seat: z.number().int().min(0).max(9).optional(),
          accountId: z.string().min(1).max(64).optional(),
          nickname: z.string().min(1).max(64).optional(),
          avatarSpec: z.unknown().optional(),
          titleAtPlay: z.string().min(1).max(64).optional(),
          stats: PlayerStatsSchema,
        }),
      )
      .min(2)
      .max(10),
    summary: z.strictObject({
      rounds: z.number().int().min(0).max(100_000),
      totalPulls: z.number().int().min(0).max(100_000),
      dareDevilMoments: z.number().int().min(0).max(100_000),
    }),
    winnerSeat: z.number().int().min(0).max(9).nullable(),
    aborted: z.boolean(),
  }),
  roomCode: z.string().min(1).max(16),
  seed: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER),
  log: z.array(LogEntrySchema).max(100_000),
  endedAt: z.date(),
});

type ParsedPayload = z.infer<typeof GrantPayloadSchema>;
type ParsedRecord = ParsedPayload['record'];
type ParsedPlayer = ParsedRecord['players'][number];

export class GrantPayloadError extends Error {
  constructor(readonly issues: readonly z.core.$ZodIssue[]) {
    super(`invalid grantMatchRewards payload (${issues.length} issue(s))`);
    this.name = 'GrantPayloadError';
  }
}

/**
 * Internal sentinel: users.updateOne matched 0 (a ban — or account deletion —
 * landed mid-transaction). THROWN inside the grant tx so Mongo ABORTS it. The
 * xp_events anchor was the tx's first write and must not survive without its
 * grant: a committed anchor would make every future re-fire report this
 * player as `already-granted` and silently drop the reward forever.
 */
class GrantWithheldMidFlightError extends Error {
  constructor() {
    super('grant withheld mid-flight');
    this.name = 'GrantWithheldMidFlightError';
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Results (S1 pushes unlock toasts from these; game:over broadcasts the record)
// ─────────────────────────────────────────────────────────────────────────────

export type GrantPlayerStatus =
  | 'granted'
  | 'already-granted'
  | 'skipped-no-account'
  | 'skipped-unknown-user'
  | 'skipped-banned';

export interface GrantPlayerResult {
  accountId: string | null;
  seat: number;
  status: GrantPlayerStatus;
  /** Claimed values, straight from the record. */
  xpEarned: number;
  coinsEarned: number;
  /** Actually written (0 when capped or skipped). */
  xpCredited: number;
  coinsCredited: number;
  coinsCapped: boolean;
  /** Recomputed level after the grant. */
  level: number;
  levelUp: boolean;
  unlockedTitles: string[];
  unlockedItems: string[];
}

export interface GrantSummary {
  matchId: string;
  matchRecord: 'inserted' | 'already-present';
  matchReplay: 'inserted' | 'already-present';
  players: GrantPlayerResult[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Persistence (match_records + match_replay_seeds) — once per match
// ─────────────────────────────────────────────────────────────────────────────

interface StatsRow {
  _id: unknown;
  matches: unknown;
  wins: unknown;
  kills: unknown;
  catches: unknown;
  falseAccusations: unknown;
  bluffSuccesses: unknown;
  pullsSurvived: unknown;
}

function buildMatchRecordDoc(
  record: ParsedRecord,
  roomCode: string,
  endedAt: Date,
): MatchRecordFields {
  const startedAtMs =
    typeof record.startedAt === 'number' ? record.startedAt : endedAt.getTime();
  const startedAt = new Date(startedAtMs);
  const players: MatchRecordFields['players'] = [];
  for (const player of record.players) {
    if (!player.accountId || !mongoose.isValidObjectId(player.accountId)) {
      // Spectator/ghost seats cannot be persisted (model requires accountId).
      console.warn(
        `[economy] match_records: player without a valid accountId dropped (match=${record.matchId} seat=${player.seat ?? -1})`,
      );
      continue;
    }
    const s = player.stats;
    players.push({
      accountId: new mongoose.Types.ObjectId(player.accountId),
      seat: player.seat ?? 0,
      nickname: player.nickname ?? 'Player',
      avatarSpec: player.avatarSpec ?? {},
      ...(player.titleAtPlay ? { titleAtPlay: player.titleAtPlay } : {}),
      stats: {
        kills: s.kills,
        catches: s.catches,
        falseAccusations: s.falseAccusations,
        bluffSuccesses: s.bluffSuccesses,
        deaths: s.deaths,
        ...(s.deathCause ? { deathCause: s.deathCause } : {}),
        pullsSurvived: s.pullsSurvived,
        roundsPlayed: s.roundsPlayed,
        won: s.won,
        xpEarned: s.xpEarned,
        coinsEarned: s.coinsEarned,
      },
    });
  }
  return {
    matchId: record.matchId,
    roomCode: record.roomCode ?? roomCode,
    startedAt,
    endedAt,
    capacity: record.capacity,
    theme: record.theme ?? 'saloon',
    players,
    summary: {
      rounds: record.summary.rounds,
      totalPulls: record.summary.totalPulls,
      dareDevilMoments: record.summary.dareDevilMoments,
    },
  };
}

async function insertOnce(
  work: () => Promise<unknown>,
): Promise<'inserted' | 'already-present'> {
  try {
    await work();
    return 'inserted';
  } catch (err) {
    if (isDuplicateKeyError(err)) return 'already-present';
    throw err;
  }
}

/**
 * Cumulative stats for titles/progress — recompute-on-read from
 * match_records ("THE only source", STR/09 — cheap at v1 scale).
 */
async function cumulativeStats(
  accountId: mongoose.Types.ObjectId,
  session?: ClientSession,
): Promise<CumulativeStats> {
  const aggregate = MatchRecordModel.aggregate<StatsRow>([
    { $unwind: '$players' },
    { $match: { 'players.accountId': accountId } },
    {
      $group: {
        _id: '$players.accountId',
        matches: { $sum: 1 },
        wins: { $sum: { $cond: [{ $eq: ['$players.stats.won', true] }, 1, 0] } },
        kills: { $sum: '$players.stats.kills' },
        catches: { $sum: '$players.stats.catches' },
        falseAccusations: { $sum: '$players.stats.falseAccusations' },
        bluffSuccesses: { $sum: '$players.stats.bluffSuccesses' },
        pullsSurvived: { $sum: '$players.stats.pullsSurvived' },
      },
    },
  ]);
  if (session) aggregate.session(session);
  const rows = await aggregate.exec();
  const row = rows[0];
  const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
  return {
    matches: num(row?.matches),
    wins: num(row?.wins),
    kills: num(row?.kills),
    catches: num(row?.catches),
    falseAccusations: num(row?.falseAccusations),
    bluffSuccesses: num(row?.bluffSuccesses),
    pullsSurvived: num(row?.pullsSurvived),
  };
}

interface LeanUserDoc {
  _id: unknown;
  xp?: unknown;
  level?: unknown;
  banned?: unknown;
}

// ─────────────────────────────────────────────────────────────────────────────
// Per-player grant (one transaction; anchor-first idempotence)
// ─────────────────────────────────────────────────────────────────────────────

async function grantPlayer(
  player: ParsedPlayer,
  ctx: { matchId: string; endedAt: Date },
): Promise<GrantPlayerResult> {
  const xpEarned = player.stats.xpEarned;
  const coinsEarned = player.stats.coinsEarned;
  const seat = player.seat ?? -1;
  const base = {
    seat,
    xpEarned,
    coinsEarned,
    xpCredited: 0,
    coinsCredited: 0,
    coinsCapped: false,
    level: 1,
    levelUp: false,
    unlockedTitles: [] as string[],
    unlockedItems: [] as string[],
  };

  const accountId = player.accountId;
  if (!accountId || !mongoose.isValidObjectId(accountId)) {
    console.warn(`[economy] grant skip (no account) match=${ctx.matchId} seat=${seat}`);
    return { ...base, accountId: null, status: 'skipped-no-account' };
  }

  const user = (await User.findById(accountId)
    .select('nickname xp level banned')
    .lean()
    .exec()) as LeanUserDoc | null;
  if (!user) {
    console.warn(`[economy] grant skip (unknown user) match=${ctx.matchId} user=${accountId}`);
    return { ...base, accountId, status: 'skipped-unknown-user' };
  }
  const currentXp = typeof user.xp === 'number' ? user.xp : 0;
  const currentLevel = typeof user.level === 'number' ? user.level : 1;
  if (user.banned === true) {
    // Banned = no grant of anything — coins, XP, titles, items. Loud log.
    console.warn(`[economy] grant skip (banned) match=${ctx.matchId} user=${accountId}`);
    return { ...base, accountId, status: 'skipped-banned', level: currentLevel };
  }

  const accountObjectId = new mongoose.Types.ObjectId(accountId);
  const matchId = ctx.matchId;
  const endedAt = ctx.endedAt;

  const runGrant = async (session: ClientSession): Promise<GrantPlayerResult> => {
    const sessionArg = session ? { session } : undefined;

    // 1) ANCHOR — unique (accountId, matchId). Duplicate = this player's
    //    grant already fully committed (a double-fire from S1 is a no-op).
    try {
      await XpEvent.create(
        [{ accountId: accountObjectId, matchId, xp: xpEarned, at: endedAt }],
        sessionArg,
      );
    } catch (err) {
      if (isDuplicateKeyError(err)) {
        return { ...base, accountId, status: 'already-granted' as const, level: currentLevel };
      }
      throw err;
    }

    // 2) users: apply the record's XP, recompute level from the new total.
    //    The banned filter is the backstop against a ban landing mid-grant.
    const newXp = currentXp + xpEarned;
    const newLevel = computeLevel(newXp);
    const update = await User.updateOne(
      { _id: accountObjectId, banned: { $ne: true } },
      { $set: { level: newLevel }, ...(xpEarned > 0 ? { $inc: { xp: xpEarned } } : {}) },
      sessionArg,
    ).exec();
    if (update && typeof update.matchedCount === 'number' && update.matchedCount === 0) {
      // Ban (or account deletion) landed mid-flight: THROW so the transaction
      // ABORTS — the anchor insert must not commit without its grant, or a
      // re-fire would report this player as "already-granted" forever.
      throw new GrantWithheldMidFlightError();
    }

    // 3) coins — apply the record's number, behind STR/04 §2's earn cap.
    let coinsCredited = 0;
    let coinsCapped = false;
    if (coinsEarned > 0) {
      const since = new Date(endedAt.getTime() - EARN_WINDOW_MS);
      const recentEvents = await WalletLedger.countDocuments(
        { accountId: accountObjectId, reason: 'match_reward', at: { $gte: since } },
        sessionArg,
      ).exec();
      if (Number(recentEvents) >= EARN_EVENTS_PER_HOUR) {
        coinsCapped = true;
        console.warn(
          `[economy] earn cap (${EARN_EVENTS_PER_HOUR}/hour) — coins withheld match=${matchId} user=${accountId}`,
        );
      } else {
        await appendLedger(
          {
            accountId: accountObjectId,
            delta: coinsEarned,
            reason: 'match_reward',
            refId: matchId,
            txId: `match:${matchId}:${accountId}`,
          },
          session,
        );
        // Duplicate txId after the anchor passed = a concurrent grant lost
        // the race for the same player+match; the coins are committed under
        // the identical key — treat as credited, never an error.
        coinsCredited = coinsEarned;
      }
    }

    // 4) titles — recomputed from match_records (this match already persisted).
    const stats = await cumulativeStats(accountObjectId, session);
    const unlockedTitles: string[] = [];
    for (const title of computeUnlockedTitles(stats)) {
      const upsert = await TitleProgress.updateOne(
        { accountId: accountObjectId, titleId: title.id },
        {
          $setOnInsert: {
            accountId: accountObjectId,
            titleId: title.id,
            unlockedAt: endedAt,
            progress: title.progress(stats),
          },
        },
        { upsert: true, ...(session ? { session } : {}) },
      ).exec();
      if (upsert && typeof upsert.upsertedCount === 'number' && upsert.upsertedCount === 1) {
        unlockedTitles.push(title.id);
      }
    }

    // 5) earned-only cosmetics — every active level-locked catalog item whose
    //    levelReq the player now meets (prestige frames at 10/20/30/40).
    const eligible = await CatalogItem.find({
      active: true,
      levelReq: { $gt: 0, $lte: newLevel },
    })
      .lean()
      .exec();
    const unlockedItems: string[] = [];
    for (const item of eligible) {
      const itemId = String(item._id);
      const kind = item.category === 'theme' ? 'theme' : 'item';
      const key = itemId.slice(item.category.length + 1) || itemId;
      try {
        await Entitlement.create(
          [{ accountId: accountObjectId, kind, key, source: 'level' }],
          sessionArg,
        );
        unlockedItems.push(itemId);
      } catch (err) {
        if (!isDuplicateKeyError(err)) throw err; // already earned = fine
      }
    }

    return {
      accountId,
      seat,
      status: 'granted' as const,
      xpEarned,
      coinsEarned,
      xpCredited: xpEarned,
      coinsCredited,
      coinsCapped,
      level: newLevel,
      levelUp: newLevel > currentLevel,
      unlockedTitles,
      unlockedItems,
    };
  };

  try {
    return await withTransaction(runGrant);
  } catch (err) {
    if (err instanceof GrantWithheldMidFlightError) {
      // The tx aborted — NOTHING from it persisted (anchor included).
      console.warn(`[economy] grant skip (banned mid-flight) match=${matchId} user=${accountId}`);
      return { ...base, accountId, status: 'skipped-banned' as const, level: currentLevel };
    }
    throw err;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// grantMatchRewards
// ─────────────────────────────────────────────────────────────────────────────

export async function grantMatchRewards(payload: GrantMatchRewardsPayload): Promise<GrantSummary> {
  const parsed = GrantPayloadSchema.safeParse(payload);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    console.error(
      `[economy] grantMatchRewards payload REJECTED (${first ? `${first.path.join('.')}: ${first.message}` : 'invalid'})`,
    );
    throw new GrantPayloadError(parsed.error.issues);
  }
  const { record, roomCode, seed, log, endedAt } = parsed.data;
  const matchId: string = record.matchId;

  // Match-scoped persistence first; duplicate keys = already done → proceed
  // to per-player grants anyway (a prior partial failure retries clean).
  const matchRecord = await insertOnce(() =>
    MatchRecordModel.create([
      buildMatchRecordDoc(record, roomCode, endedAt),
    ]),
  );
  const matchReplay = await insertOnce(() =>
    MatchReplay.create([
      {
        matchId,
        roomCode,
        seed,
        winnerSeat: record.winnerSeat,
        aborted: record.aborted,
        log,
        endedAt,
      },
    ]),
  );

  const players: GrantPlayerResult[] = [];
  for (const player of record.players) {
    players.push(await grantPlayer(player, { matchId, endedAt }));
  }

  return { matchId, matchRecord, matchReplay, players };
}
