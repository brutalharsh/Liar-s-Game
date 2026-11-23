/**
 * @liars-game/rules-engine — domain types.
 *
 * Implements STR/01-game-rules (incl. owner amendments A1 execution dynamic,
 * A2 challenge windows, A3 deck scaling, A4 timers) + research/02 §9 loop.
 *
 * SELF-CONTAINED by design: no imports from @liars-game/shared or apps/ (wave-1
 * parallel build). Small wire-shaped types are duplicated here and marked
 * `TODO-sync-with-shared` — the S1 server agent reconciles next wave.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Cards
// ─────────────────────────────────────────────────────────────────────────────

/** Liar-deck ranks. `'JOKER'` is wild: counts as any Table Rank (always "truth"). */
// TODO-sync-with-shared
export type Rank = 'K' | 'Q' | 'A' | 'JOKER';

/** The three possible Table Cards drawn from the 1K/1Q/1A table deck each round. */
// TODO-sync-with-shared
export type TableRank = 'K' | 'Q' | 'A';

export const TABLE_RANKS: readonly TableRank[] = ['K', 'Q', 'A'] as const;

/** Stable unique card identity (unique across a full built deck). */
// TODO-sync-with-shared
export type CardId = string;

// TODO-sync-with-shared
export interface Card {
  id: CardId;
  rank: Rank;
}

// ─────────────────────────────────────────────────────────────────────────────
// Shot / roulette vocabulary
// ─────────────────────────────────────────────────────────────────────────────

/** STR/01 §6 (A1): who pulls the trigger on the challenge loser. */
// TODO-sync-with-shared
export type ShotKind = 'SELF' | 'EXECUTE_BY_ACCUSER';

/** Deaths + deathCause per STR/01 §10. */
export type DeathCause = 'selfRoulette' | 'executed';

/** Challenge verdict after revealing the accused's last play. */
export type Verdict = 'TRUTH' | 'LIE';

export type ShotOutcome = 'BLANK' | 'LIVE';

// ─────────────────────────────────────────────────────────────────────────────
// Phases (STR/01 condensed loop; STR/03 §2)
// LOBBY → ROUND_NEW → TURN → WINDOW → REVEAL → SHOT → ROUND_END → GAME_END
// (WINDOW is only ever entered at 5+ alive players / open-window mode.)
// ─────────────────────────────────────────────────────────────────────────────

export type Phase =
  'LOBBY' | 'ROUND_NEW' | 'TURN' | 'WINDOW' | 'REVEAL' | 'SHOT' | 'ROUND_END' | 'GAME_END';

// ─────────────────────────────────────────────────────────────────────────────
// Config
// ─────────────────────────────────────────────────────────────────────────────

/** STR/01 §2.2/§4 (A2: window is only used at 5–10 players; `auto` follows alive count). */
export type ChallengeWindowMode = 'next-only' | 'open-window';

export interface MatchConfig {
  /** Host "fast table" toggle → 10s turns (A4). */
  fastMode: boolean;
  /** Optional hard override of the turn timer (ms). Balance tuning (doc-14 task 140). */
  turnTimerMsOverride?: number;
  /** `auto` = derived from current alive count (≤4 next-only, ≥5 open window). */
  windowMode: ChallengeWindowMode | 'auto';
  /** A2 arm-delay after a play lands before a CHECK is legal. */
  armDelayMs: number;
  /** A2 open-window length. */
  windowMs: number;
  /** A4: disconnect grace before the seat is auto-played ("drunk under the table"). */
  disconnectGraceMs: number;
}

export const DEFAULT_MATCH_CONFIG: MatchConfig = {
  fastMode: false,
  turnTimerMsOverride: undefined,
  windowMode: 'auto',
  armDelayMs: 2_000,
  windowMs: 10_000,
  disconnectGraceMs: 60_000,
};

/** A4 timer ladder: 30s @2–3p, 20s @4–5p, 15s @6–10p, 10s fast. */
export function turnTimerMs(config: MatchConfig, aliveCount: number): number {
  if (config.turnTimerMsOverride !== undefined) return config.turnTimerMsOverride;
  if (config.fastMode) return 10_000;
  if (aliveCount <= 3) return 30_000;
  if (aliveCount <= 5) return 20_000;
  return 15_000;
}

/** A2: which challenge rule applies right now. `auto` derives from alive count. */
export function challengeModeFor(config: MatchConfig, aliveCount: number): ChallengeWindowMode {
  if (config.windowMode !== 'auto') return config.windowMode;
  return aliveCount <= 4 ? 'next-only' : 'open-window';
}

// ─────────────────────────────────────────────────────────────────────────────
// Roster / players
// ─────────────────────────────────────────────────────────────────────────────

/** Seat-requested roster entry (passed at createMatch; echo fields flow to MatchRecord). */
export interface RosterEntry {
  /** Seat index 0..N-1. Seat order ascending = counter-clockwise turn order. */
  seat: number;
  accountId?: string;
  nickname?: string;
  /** Opaque echo for STR/09 match_records; never inspected by the engine. */
  avatarSpec?: unknown;
  titleAtPlay?: string;
}

/**
 * Per-player stats — exactly the STR/09 match_records.stats shape.
 * + `roundsSurvived` (internal counter: rounds the player was alive at end — the
 *   "+1 coin per round survived" input, STR/04 §2) is folded out at emission.
 */
// TODO-sync-with-shared
export interface PlayerStats {
  /** EXECUTE shots you fired where the target died (credited to the executor). */
  kills: number;
  /** Correct LIAR calls (the accused really lied) — incl. forced calls (see README). */
  catches: number;
  /** Wrong calls — incl. forced calls (see README interpretation). */
  falseAccusations: number;
  /** Plays containing ≥1 lie that went unchallenged and un-revealed. */
  bluffSuccesses: number;
  deaths: number;
  deathCause?: DeathCause;
  /** Blanks survived (does not include the fatal pull). */
  pullsSurvived: number;
  /** Rounds the player was alive at the round's deal. */
  roundsPlayed: number;
  /** Rounds the player was alive when the round ended (+1 coin each, STR/04 §2). */
  roundsSurvived: number;
  won: boolean;
  xpEarned: number;
  coinsEarned: number;
}

export interface PlayerState {
  seat: number;
  accountId?: string;
  nickname?: string;
  avatarSpec?: unknown;
  titleAtPlay?: string;

  alive: boolean;
  /** Own hand. Hidden: never serialized beyond the owning seat's view. */
  hand: Card[];
  /** Pre-staged selection (A4 timeout auto-play source). Updated via STAGE. */
  staged: CardId[];

  /**
   * Chamber index of the live round, uniform 1..6, fixed at MATCH START (Model A).
   * NEVER sent to any client — not even the owner (STR/07 §3).
   */
  bulletPos: number;
  /** Total pulls taken (public `(pulled/6)` badge source). */
  pulls: number;

  /** Epoch-ms of the latest DISCONNECT; undefined while connected. */
  disconnectedAt?: number;
  /** Seat lost: PLAYER_LEAVE, or grace elapsed without reconnect. */
  abandoned: boolean;
  left: boolean;

  stats: PlayerStats;
}

// ─────────────────────────────────────────────────────────────────────────────
// Round / turn / window state
// ─────────────────────────────────────────────────────────────────────────────

/** One face-down committed play on the pile (R12: playing = implicit claim). */
export interface Play {
  seq: number;
  seat: number;
  cards: Card[];
  at: number;
}

/** A2 open challenge window (5–10 players). Null/absent in next-only mode. */
export interface WindowState {
  playSeq: number;
  accusedSeat: number;
  openedAt: number;
  /** CHECK is illegal before this (anti reaction-time snipe). */
  armedAt: number;
  closesAt: number;
}

/** Fully-computed result of a (voluntary or forced) LIAR resolution. */
export interface ChallengeResolution {
  challengerSeat: number;
  accusedSeat: number;
  cards: Card[];
  verdict: Verdict;
  forced: boolean;
  loserSeat: number;
  /** 'accused' = caught liar; 'accuser' = false accuser. */
  loserRole: 'accused' | 'accuser';
  shotKind: ShotKind;
  /** Present iff EXECUTE_BY_ACCUSER (executor = the accuser; target locked to loser). */
  executorSeat?: number;
  pullNo: number;
  outcome: ShotOutcome;
  died: boolean;
  deathCause?: DeathCause;
  /** Survived a 50/50 pull #5 — the "daredevil moment" (see README). */
  dareDevil: boolean;
}

export interface RoundState {
  roundNo: number;
  tableCard: TableRank;
  /** Who started this round (starter-rule bookkeeping, STR/01 §2.3). */
  starterSeat: number;
  pile: Play[];
  /** Undealt cards, stay hidden (R5). */
  leftover: Card[];
  window?: WindowState;
  resolution?: ChallengeResolution;
}

export interface TurnState {
  seat: number;
  startedAt: number;
  /** = startedAt + turnTimerMs(). Server's timer wheel fires TURN_TIMEOUT at/after this. */
  deadline: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Events (server → engine inputs; discriminated union)
// ─────────────────────────────────────────────────────────────────────────────

export type GameEvent =
  /** LOBBY → rolls bulletPos per player + random starter, deals round 1. */
  | { type: 'MATCH_START'; at: number }
  /** ROUND_NEW → TURN (turn begins on pendingStarter). */
  | { type: 'BEGIN_TURNS'; at: number }
  /** Commit 1..3 of your own cards face-down (your turn). */
  | { type: 'PLAY'; seat: number; cardIds: CardId[]; at: number }
  /** Call LIAR on the previous/current-window play. `accusedSeat` optional client guard. */
  | { type: 'LIAR'; seat: number; accusedSeat?: number; at: number }
  /** Pre-stage a selection (self or empty = clear) — A4 auto-play source. */
  | { type: 'STAGE'; seat: number; cardIds: CardId[]; at: number }
  /** Timer-wheel: turn deadline reached → auto-play pre-staged else 1 random card. */
  | { type: 'TURN_TIMEOUT'; seat: number; at: number }
  /** Timer-wheel: open window expired unchallenged. */
  | { type: 'WINDOW_EXPIRE'; at: number }
  | { type: 'DISCONNECT'; seat: number; at: number }
  | { type: 'RECONNECT'; seat: number; at: number }
  /** Grace elapsed while disconnected → seat lost (auto-play continues). */
  | { type: 'ABANDON'; seat: number; at: number }
  /** Permanently left the table (also marks abandoned). */
  | { type: 'LEAVE'; seat: number; at: number }
  /** Reveal cinematic finished → SHOT. */
  | { type: 'REVEAL_ACK'; at: number }
  /** Shot resolved/cinematic finished → ROUND_END | GAME_END. */
  | { type: 'SHOT_ACK'; at: number }
  /** ROUND_END → ROUND_NEW (reshuffle, redeal, new table card, next starter). */
  | { type: 'NEXT_ROUND'; at: number };

// ─────────────────────────────────────────────────────────────────────────────
// Effects (engine → server broadcasts; carry everything STR/07 needs)

// PRIVATE-BY-ROUTING payloads (HAND_DEALT, REVEALED, SHOT_ASSIGNED post-event)
// are public *after* their trigger moment; the server view-filters per STR/07 §3.
// ─────────────────────────────────────────────────────────────────────────────

export type Effect =
  | { kind: 'MATCH_STARTED'; seats: number[]; starterSeat: number }
  | {
      kind: 'ROUND_STARTED';
      roundNo: number;
      tableCard: TableRank;
      dealtCounts: { seat: number; count: number }[];
      deckSize: number;
      leftoverCount: number;
    }
  /** PRIVATE: hand for one seat → server routes hand:deal to that seat only. */
  | { kind: 'HAND_DEALT'; seat: number; cards: Card[] }
  | { kind: 'TURN_STARTED'; seat: number; deadline: number }
  | {
      kind: 'PLAYED';
      seat: number;
      count: number;
      pile: { seat: number; count: number }[];
      auto?: 'timeout' | 'disconnect';
    }
  | {
      kind: 'WINDOW_OPENED';
      playSeq: number;
      accusedSeat: number;
      openedAt: number;
      armedAt: number;
      closesAt: number;
    }
  | { kind: 'WINDOW_CLOSED'; reason: 'believed' | 'expired' | 'challenged'; accusedSeat: number }
  | {
      kind: 'REVEALED';
      challengerSeat: number;
      accusedSeat: number;
      cards: Card[];
      verdict: Verdict;
      loserSeat: number;
      forced: boolean;
    }
  | { kind: 'SHOT_ASSIGNED'; loserSeat: number; shotKind: ShotKind; executorSeat?: number }
  | {
      kind: 'SHOT_RESULT';
      loserSeat: number;
      pullNo: number;
      outcome: ShotOutcome;
      died: boolean;
      deathCause?: DeathCause;
    }
  | {
      kind: 'ROUND_ENDED';
      roundNo: number;
      reason: 'caught-liar' | 'false-accusation';
      loserSeat: number;
      survived: boolean;
      dareDevil: boolean;
    }
  | { kind: 'GAME_OVER'; winnerSeat: number | null; aborted: boolean; record: MatchRecord }
  | { kind: 'PRESENCE'; seat: number; connected: boolean; abandoned: boolean };

// ─────────────────────────────────────────────────────────────────────────────
// Errors (typed; every rejection carries a code the server can log/forward)
// ─────────────────────────────────────────────────────────────────────────────

export type ErrCode =
  | 'ERR_MATCH_NOT_STARTED'
  | 'ERR_MATCH_OVER'
  | 'ERR_TOO_FEW_PLAYERS'
  | 'ERR_WRONG_PHASE'
  | 'ERR_NOT_YOUR_TURN'
  | 'ERR_NOT_SEATED'
  | 'ERR_DEAD'
  | 'ERR_DISCONNECTED'
  | 'ERR_ABANDONED'
  | 'ERR_GRACE'
  | 'ERR_TOO_EARLY'
  | 'ERR_FIRST_PLAY'
  | 'ERR_WINDOW_CLOSED'
  | 'ERR_WINDOW_NOT_ARMED'
  | 'ERR_SELF_CHALLENGE'
  | 'ERR_WRONG_ACCUSED'
  | 'ERR_INVALID_COUNT'
  | 'ERR_DUPLICATE_CARD'
  | 'ERR_NOT_OWNED_CARD'
  | 'ERR_NOT_DISCONNECTED'
  | 'ERR_INTERNAL';

// TODO-sync-with-shared (shape mirrors STR/07 `error {code, message, eventRef}`)
export interface GameError {
  code: ErrCode;
  message: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// MatchRecord (STR/09 §match_records — engine emits the stats core;
// the server merges envelope fields at persistence time)
// ─────────────────────────────────────────────────────────────────────────────

export interface MatchSummary {
  rounds: number;
  totalPulls: number;
  dareDevilMoments: number;
}

export interface MatchRecordPlayer extends RosterEntry {
  stats: PlayerStats;
}

// TODO-sync-with-shared
export interface MatchRecord {
  matchId?: string;
  roomCode?: string;
  startedAt?: number;
  endedAt?: number;
  capacity: number;
  theme?: string;
  players: MatchRecordPlayer[];
  summary: MatchSummary;
  winnerSeat: number | null;
  aborted: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// Event log (append-only; input for the wave-2 hash-chain, doc-14 task 111)
// ─────────────────────────────────────────────────────────────────────────────

/** Every event passed through apply(), accepted or rejected, in order. */
export interface LogEntry {
  seq: number;
  event: GameEvent;
  accepted: boolean;
  errCode?: ErrCode;
}

// ─────────────────────────────────────────────────────────────────────────────
// State + apply result
// ─────────────────────────────────────────────────────────────────────────────

export interface GameState {
  phase: Phase;
  config: MatchConfig;
  players: PlayerState[];
  /** Fixed at createMatch = roster length; deck module m = ceil(capacity/4). */
  capacity: number;
  matchId?: string;
  roomCode?: string;
  theme?: string;
  /** Set when the match runs on SeededRng(seed) — the deterministic-replay pin. */
  initialSeed: number | null;
  /** Live counter of survived 50/50 pulls (#5) — feeds MatchRecord.summary. */
  dareDevilMoments: number;

  round: RoundState | null;
  turn: TurnState | null;
  /** Starter for the round about to begin (STR/01 §2.3 chain). */
  pendingStarter: number | null;

  matchStartAt?: number;
  endAt?: number;
  winnerSeat: number | null;
  aborted: boolean;
  /** Completed rounds (a round completes only via SHOT_ACK — one roulette each, R10). */
  completedRounds: number;
  matchRecord: MatchRecord | null;

  log: LogEntry[];
  /** Injected RNG port (STR/08: all game RNG through here). Never serialized. */
  rng: RngPortLike;
  playSeq: number;
  eventSeq: number;
}

export interface ApplyResult {
  state: GameState;
  effects: Effect[];
  err?: GameError;
}

// Local structural stand-in to avoid a runtime import cycle in the type layer.
// TODO-sync-with-shared (canonical RngPort lives in ./rng.ts and is exported there)
export interface RngPortLike {
  int(minInclusive: number, maxInclusive: number): number;
  pick<T>(items: readonly T[]): T;
  shuffle<T>(items: readonly T[]): T[];
}
