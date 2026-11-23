/**
 * Domain types + zod schemas — THE wire contract for Liar's Game.
 *
 * View-filtering rules (STR/07 §3) are encoded HERE, structurally:
 *  - `ViewPlayerState` carries counts only (handCount) — never another player's card ranks.
 *  - `PlayerState.hand` is the ONLY place card ranks are legal (the owner's own hand),
 *    besides `reveal:show` payloads (the single face-leak event).
 *  - `bulletPos` / chamber position does not exist anywhere in this file — it must
 *    never be serialized (STR/08 §1).
 */
import { z } from 'zod';
import { RoomCodeSchema } from './room-code.js';

// ---------------------------------------------------------------------------
// Primitives
// ---------------------------------------------------------------------------

/** Seat index, 0-based. Rooms hold 2–10 players. */
export const SeatSchema = z.number().int().min(0).max(9);
export type Seat = z.infer<typeof SeatSchema>;

/**
 * Card rank. `J` = Joker (wild — always counts as the Table Card per STR/01 §3).
 * Deck composition per STR/01 §1: Kings, Queens, Aces + 2 Jokers per deck block.
 */
export const RankSchema = z.enum(['K', 'Q', 'A', 'J']);
export type Rank = z.infer<typeof RankSchema>;

/** Table Card drawn each round from {K, Q, A} (STR/01 §1). Jokers are never table cards. */
export const TableCardSchema = z.enum(['K', 'Q', 'A']);
export type TableCard = z.infer<typeof TableCardSchema>;

/** A physical card. `id` is the opaque server-assigned identifier (e.g. "c_17"). */
export const CardSchema = z.strictObject({
  id: z.string().min(1).max(64),
  rank: RankSchema,
});
export type Card = z.infer<typeof CardSchema>;

/** Epoch-ms deadline timestamp (server clock is the only one that acts on it — STR/07 §4). */
export const DeadlineTsSchema = z.number().int().min(1);

/** Room lifecycle phases as seen on the wire (mirrors the server FSM, research/11 §4.1). */
export const RoomPhaseSchema = z.enum([
  'lobby',
  'dealing',
  'playing',
  'reveal',
  'roulette',
  'roundEnd',
  'gameOver',
]);
export type RoomPhase = z.infer<typeof RoomPhaseSchema>;

/** Room visibility: `public` rooms appear in `GET /api/rooms`; `private` are code-only. */
export const RoomVisibilitySchema = z.enum(['public', 'private']);
export type RoomVisibility = z.infer<typeof RoomVisibilitySchema>;

/** Who pulls the trigger after a challenge (STR/01 §6). */
export const ShotKindSchema = z.enum(['SELF', 'EXECUTE']);
export type ShotKind = z.infer<typeof ShotKindSchema>;

/** Death attribution for stats (STR/01 §10). */
export const DeathCauseSchema = z.enum(['selfRoulette', 'executed']);
export type DeathCause = z.infer<typeof DeathCauseSchema>;

// ---------------------------------------------------------------------------
// Avatars (server validates owned + valid slugs — STR/08 §7)
// ---------------------------------------------------------------------------

export const AvatarSpecSchema = z.strictObject({
  base: z.string().min(1).max(64),
  hair: z.string().min(1).max(64).optional(),
  beard: z.string().min(1).max(64).optional(),
  hat: z.string().min(1).max(64).optional(),
  shirt: z.string().min(1).max(64).optional(),
  glasses: z.string().min(1).max(64).optional(),
  frame: z.string().min(1).max(64).optional(),
  anim: z.string().min(1).max(64).optional(),
  voicePack: z.string().min(1).max(64).optional(),
});
export type AvatarSpec = z.infer<typeof AvatarSpecSchema>;

/**
 * The 7 canonical avatar bodies (owner-dictated 2026-11-23): humans cross
 * sex (male/female) × build (thin/gym; `human-male-thin` is the DEFAULT) plus
 * upright humanoid species (dog/cat/horse — two arms, species head, NOT
 * feral quadrupeds). `base` stays a single combined slug so every existing
 * consumer (tables, admin chips, wire payloads) stays byte-compatible.
 */
export const AVATAR_BASE_IDS = [
  'human-male-thin',
  'human-female-thin',
  'human-male-gym',
  'human-female-gym',
  'dog',
  'cat',
  'horse',
] as const;
export type AvatarBaseId = (typeof AVATAR_BASE_IDS)[number];

/** Wire-safe enum of the 7 canonical bases — the server's equip-side gate. */
export const AVATAR_BASE_IDS_SCHEMA = z.enum(AVATAR_BASE_IDS);

/** The base every new/blank spec falls back to. */
export const DEFAULT_AVATAR_BASE: AvatarBaseId = 'human-male-thin';

/**
 * Slots a paper-doll part attaches to. Slot strings in `AvatarSpecSchema`
 * stay open strings (catalog-validated server-side, STR/08 §7); THIS union
 * is the typed surface for equip endpoints and the web avatar engine.
 * `base` is deliberately NOT attachable — it joins via `AVATAR_BASE_IDS`.
 */
export const AttachableSlotsSchema = z.enum(['hair', 'beard', 'hat', 'shirt', 'glasses']);
export type AttachableSlot = z.infer<typeof AttachableSlotsSchema>;

/** Long-name aliases for the equip surface (owner-mission contract). */
export const AvatarAttachableSlotSchema = AttachableSlotsSchema;
export type AvatarAttachableSlot = AttachableSlot;

// ---------------------------------------------------------------------------
// Seats & players (per-viewer — this is the anti-cheat surface)
// ---------------------------------------------------------------------------

/**
 * A seat in the lobby / presence view. `nickname: null` = empty (ghost chair);
 * a seat with a nickname and `alive: false` is a dead-but-present player.
 */
export const SeatSnapshotSchema = z.strictObject({
  seat: SeatSchema,
  nickname: z.string().min(1).max(18).nullable(),
  avatarSpec: AvatarSpecSchema.nullable(),
  connected: z.boolean(),
  afk: z.boolean(),
  isHost: z.boolean(),
});
export type SeatSnapshot = z.infer<typeof SeatSnapshotSchema>;

/**
 * What a client may know about ANOTHER player (STR/07 §3 — counts only).
 * There is deliberately no `hand` field; `handCount` is all that ever leaves
 * the server before `reveal:show`.
 */
export const ViewPlayerStateSchema = z.strictObject({
  seat: SeatSchema,
  nickname: z.string().min(1).max(18).nullable(),
  avatarSpec: AvatarSpecSchema.nullable(),
  connected: z.boolean(),
  afk: z.boolean(),
  isHost: z.boolean(),
  /** Bot seats (host bot-fill, STR/02). Absent = human seat. */
  isBot: z.boolean().optional(),
  /** Cards currently in this player's hand. Count only — ranks stay server-side. */
  handCount: z.number().int().min(0).max(5),
  /** Public revolver counter `(pulled/6)` — never the chamber position. */
  pulls: z.number().int().min(0).max(6),
  alive: z.boolean(),
  activeTitle: z.string().min(1).max(64).nullable(),
});
export type ViewPlayerState = z.infer<typeof ViewPlayerStateSchema>;

/** The owner's own full state — the only view where card ranks are legal. */
export const PlayerStateSchema = z.strictObject({
  seat: SeatSchema,
  nickname: z.string().min(1).max(18).nullable(),
  avatarSpec: AvatarSpecSchema.nullable(),
  connected: z.boolean(),
  afk: z.boolean(),
  isHost: z.boolean(),
  hand: z.array(CardSchema).max(5),
  handCount: z.number().int().min(0).max(5),
  pulls: z.number().int().min(0).max(6),
  alive: z.boolean(),
  activeTitle: z.string().min(1).max(64).nullable(),
});
export type PlayerState = z.infer<typeof PlayerStateSchema>;

// ---------------------------------------------------------------------------
// Room snapshot (catch-up view on join/rejoin — one per phase, STR/07 §4)
// ---------------------------------------------------------------------------

export const ChallengeWindowViewSchema = z.strictObject({
  playSeat: SeatSchema,
  closesAtTs: DeadlineTsSchema,
});
export type ChallengeWindowView = z.infer<typeof ChallengeWindowViewSchema>;

/**
 * Everything a client may know about a room, at any phase. Emitted as the
 * `lobby:state` payload (also the catch-up snapshot on (re)join).
 */
export const RoomStateSchema = z.strictObject({
  roomCode: RoomCodeSchema,
  name: z.string().min(1).max(18),
  capacity: z.number().int().min(2).max(10),
  theme: z.string().min(1).max(64),
  visibility: RoomVisibilitySchema,
  phase: RoomPhaseSchema,
  hostSeat: SeatSchema,
  seats: z.array(ViewPlayerStateSchema).min(2).max(10),
  /** The requesting player's own state. `null` for spectators. */
  you: PlayerStateSchema.nullable(),
  spectator: z.boolean(),
  /** Monotonic per-room event counter (STR/07 §4). */
  seq: z.number().int().min(0),
  roundNo: z.number().int().min(1).optional(),
  tableCard: TableCardSchema.optional(),
  currentTurnSeat: SeatSchema.nullable().optional(),
  deadlineTs: DeadlineTsSchema.nullable().optional(),
  pileTotal: z.number().int().min(0).optional(),
  /** Open challenge window (5–10 player tables, STR/01 §4); null when none. */
  challengeWindow: ChallengeWindowViewSchema.nullable().optional(),
  estMatchMinutes: z.number().int().min(1).optional(),
});
export type RoomState = z.infer<typeof RoomStateSchema>;

// ---------------------------------------------------------------------------
// Match records & stats (STR/09 — the ONLY source of leaderboards/XP/titles)
// ---------------------------------------------------------------------------

export const MatchPlayerStatsSchema = z.strictObject({
  kills: z.number().int().min(0),
  catches: z.number().int().min(0),
  falseAccusations: z.number().int().min(0),
  bluffSuccesses: z.number().int().min(0),
  /** A player dies at most once per match. */
  deaths: z.number().int().min(0).max(1),
  deathCause: DeathCauseSchema.optional(),
  pullsSurvived: z.number().int().min(0).max(5),
  roundsPlayed: z.number().int().min(0),
  won: z.boolean(),
  xpEarned: z.number().int().min(0),
  coinsEarned: z.number().int().min(0),
});
export type MatchPlayerStats = z.infer<typeof MatchPlayerStatsSchema>;

export const MatchPlayerRecordSchema = z.strictObject({
  accountId: z.string().min(1),
  seat: SeatSchema,
  nickname: z.string().min(1).max(18),
  avatarSpec: AvatarSpecSchema.nullable(),
  titleAtPlay: z.string().min(1).max(64).nullable().optional(),
  stats: MatchPlayerStatsSchema,
});
export type MatchPlayerRecord = z.infer<typeof MatchPlayerRecordSchema>;

export const MatchSummarySchema = z.strictObject({
  /** 0 is legal: a match aborted in round 1 (STR/01 §7 abort paths). */
  rounds: z.number().int().min(0),
  totalPulls: z.number().int().min(0),
  dareDevilMoments: z.number().int().min(0),
});
export type MatchSummary = z.infer<typeof MatchSummarySchema>;

/**
 * Written once at `game:over`, appended to `match_records`. Carries only
 * public information — no hidden game state rides in here.
 */
export const MatchRecordSchema = z.strictObject({
  matchId: z.string().min(1),
  roomCode: RoomCodeSchema,
  startedAt: DeadlineTsSchema,
  endedAt: DeadlineTsSchema,
  capacity: z.number().int().min(2).max(10),
  theme: z.string().min(1).max(64),
  players: z.array(MatchPlayerRecordSchema).min(2).max(10),
  summary: MatchSummarySchema,
});
export type MatchRecord = z.infer<typeof MatchRecordSchema>;

/** Per-player grant summary shown on the results screen (`game:over.rewards`). */
export const MatchRewardSchema = z.strictObject({
  seat: SeatSchema,
  accountId: z.string().min(1).optional(),
  coins: z.number().int().min(0),
  xp: z.number().int().min(0),
  unlockedTitles: z.array(z.string().min(1).max(64)),
});
export type MatchReward = z.infer<typeof MatchRewardSchema>;

// ---------------------------------------------------------------------------
// Economy & progression (STR/04)
// ---------------------------------------------------------------------------

export const XpOutcomeSchema = z.enum(['win', 'survived', 'died']);
export type XpOutcome = z.infer<typeof XpOutcomeSchema>;

/** One XP grant entry (XP per completed match: win 12 · survived 6 · died 4 — STR/04 §5). */
export const XpGainSchema = z.strictObject({
  seat: SeatSchema,
  accountId: z.string().min(1).optional(),
  outcome: XpOutcomeSchema.optional(),
  xp: z.number().int().min(0),
});
export type XpGain = z.infer<typeof XpGainSchema>;

export const LeaderboardMetricSchema = z.enum(['wins', 'kills', 'xp', 'titles']);
export type LeaderboardMetric = z.infer<typeof LeaderboardMetricSchema>;

/** One `GET /api/leaderboard?metric=…` row (aggregation over match_records, cached 60s). */
export const LeaderboardRowSchema = z.strictObject({
  accountId: z.string().min(1),
  nickname: z.string().min(1).max(18),
  avatarSpec: AvatarSpecSchema.nullable().optional(),
  activeTitle: z.string().min(1).max(64).nullable().optional(),
  level: z.number().int().min(1).optional(),
  rank: z.number().int().min(1),
  value: z.number().int().min(0),
});
export type LeaderboardRow = z.infer<typeof LeaderboardRowSchema>;

/** Coin pack in the mock shop (prices in ₹, coins are cosmetic-only — STR/04 §1). */
export const CoinPackIdSchema = z.enum(['starter', 'popular', 'big_bag', 'whale']);
export type CoinPackId = z.infer<typeof CoinPackIdSchema>;

export const CoinPackSchema = z.strictObject({
  id: CoinPackIdSchema,
  label: z.string().min(1).max(32),
  priceRupees: z.number().int().min(1),
  coins: z.number().int().min(1),
  bonusCoins: z.number().int().min(0),
});
export type CoinPack = z.infer<typeof CoinPackSchema>;
