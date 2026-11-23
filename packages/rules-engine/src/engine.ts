/**
 * The Liar's Deck state machine — `apply(state, event) → { state, effects, err? }`.
 *
 * Pure reducer: the input state is NEVER mutated; a fresh state is returned on
 * every call (successful or rejected — rejected calls change nothing but the
 * event log). All transitions are validated; illegal ones are rejected with
 * typed `ErrCode`s. All game RNG flows through the injected `RngPort`.
 *
 * Phase machine (STR/01 §11 + STR/03 §2):
 *   LOBBY → ROUND_NEW → TURN → (WINDOW) → REVEAL → SHOT → ROUND_END → ROUND_NEW…
 *   …or → GAME_END (last alive / win-by-default abort).
 *
 * Server-driven pacing events (BEGIN_TURNS / REVEAL_ACK / SHOT_ACK /
 * NEXT_ROUND) let S1 sequence its STR/07 broadcasts between cinematic beats
 * without ever recomputing outcomes — every result is fixed at resolution.
 */
import { containsLie } from './deck';
import { SeededRng, type RngPort } from './rng';
import {
  alivePlayers,
  computeNextStarter,
  finishMatch,
  holders,
  nextHolderCcw,
  presentAlivePlayers,
  seatOf,
  startRound,
} from './round';
import type {
  ApplyResult,
  Card,
  ChallengeResolution,
  Effect,
  ErrCode,
  GameEvent,
  GameState,
  MatchConfig,
  PlayerState,
  Play,
  RosterEntry,
  ShotKind,
} from './types';
import { challengeModeFor, DEFAULT_MATCH_CONFIG, turnTimerMs } from './types';

// ─────────────────────────────────────────────────────────────────────────────
// Internal rejection channel (validation failures → typed GameError)
// ─────────────────────────────────────────────────────────────────────────────

class Reject extends Error {
  constructor(
    readonly code: ErrCode,
    message: string,
  ) {
    super(message);
  }
}

function reject(code: ErrCode, message: string): never {
  throw new Reject(code, message);
}

// ─────────────────────────────────────────────────────────────────────────────
// Construction
// ─────────────────────────────────────────────────────────────────────────────

export interface CreateMatchOptions {
  /** Seated players; seats must be exactly 0..N-1 (ascending = counter-clockwise). */
  roster: RosterEntry[];
  matchId?: string;
  roomCode?: string;
  theme?: string;
  config?: Partial<MatchConfig>;
  /** Deterministic seed — replay pin. Pass this OR `rng`. */
  seed?: number;
  /** Production RNG (STR/08 crypto port). Pass this OR `seed`. */
  rng?: RngPort;
}

export function createMatch(o: CreateMatchOptions): GameState {
  const roster = o.roster;
  if (!Array.isArray(roster) || roster.length < 2 || roster.length > 10) {
    throw new Error(`createMatch: roster must have 2..10 players, got ${roster?.length}`);
  }
  const seats = roster.map((r) => r.seat).sort((a, b) => a - b);
  if (seats.some((seat, i) => seat !== i)) {
    throw new Error(`createMatch: roster seats must be exactly 0..N-1 (got [${seats.join(',')}])`);
  }
  const rng = o.rng ?? (o.seed !== undefined ? new SeededRng(o.seed) : undefined);
  if (!rng) {
    throw new Error('createMatch: pass `seed` (deterministic/replayable) or `rng` (injected)');
  }
  const config: MatchConfig = { ...DEFAULT_MATCH_CONFIG, ...o.config };

  const players: PlayerState[] = roster.map((r) => ({
    seat: r.seat,
    accountId: r.accountId,
    nickname: r.nickname,
    avatarSpec: r.avatarSpec,
    titleAtPlay: r.titleAtPlay,
    alive: true,
    hand: [],
    staged: [],
    bulletPos: 0, // fixed at MATCH_START
    pulls: 0,
    disconnectedAt: undefined,
    abandoned: false,
    left: false,
    stats: {
      kills: 0,
      catches: 0,
      falseAccusations: 0,
      bluffSuccesses: 0,
      deaths: 0,
      pullsSurvived: 0,
      roundsPlayed: 0,
      roundsSurvived: 0,
      won: false,
      xpEarned: 0,
      coinsEarned: 0,
    },
  }));

  return {
    phase: 'LOBBY',
    config,
    players,
    capacity: roster.length,
    matchId: o.matchId,
    roomCode: o.roomCode,
    theme: o.theme,
    initialSeed: o.seed !== undefined ? o.seed : null,
    dareDevilMoments: 0,
    round: null,
    turn: null,
    pendingStarter: null,
    matchStartAt: undefined,
    endAt: undefined,
    winnerSeat: null,
    aborted: false,
    completedRounds: 0,
    matchRecord: null,
    log: [],
    rng,
    playSeq: 0,
    eventSeq: 0,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Purity plumbing
// ─────────────────────────────────────────────────────────────────────────────

/** Deep copy, preserving the live `rng` reference. Input is untouched. */
export function cloneState(s: GameState): GameState {
  const { rng, ...rest } = s;
  const copy = structuredClone(rest) as Mutable<GameState>;
  copy.rng = rng;
  return copy;
}

type Mutable<T> = { -readonly [K in keyof T]: T[K] };

function appendLog(s: GameState, event: GameEvent, accepted: boolean, errCode?: ErrCode): void {
  s.eventSeq += 1;
  s.log.push({ seq: s.eventSeq, event, accepted, errCode });
}

// ─────────────────────────────────────────────────────────────────────────────
// apply
// ─────────────────────────────────────────────────────────────────────────────

export function apply(state: GameState, event: GameEvent): ApplyResult {
  const s = cloneState(state);
  const effects: Effect[] = [];
  try {
    dispatch(s, event, effects);
    appendLog(s, event, true, undefined);
    return { state: s, effects };
  } catch (e) {
    if (e instanceof Reject) {
      appendLog(s, event, false, e.code);
      return { state: s, effects, err: { code: e.code, message: e.message } };
    }
    throw e;
  }
}

function dispatch(s: GameState, ev: GameEvent, effects: Effect[]): void {
  if (s.phase === 'GAME_END') {
    reject('ERR_MATCH_OVER', `match already over (${s.aborted ? 'aborted' : 'won'})`);
  }

  if (s.phase === 'LOBBY') {
    if (ev.type === 'MATCH_START') return handleMatchStart(s, ev, effects);
    if (
      ev.type === 'DISCONNECT' ||
      ev.type === 'RECONNECT' ||
      ev.type === 'ABANDON' ||
      ev.type === 'LEAVE'
    ) {
      return handlePresence(s, ev, effects);
    }
    reject('ERR_MATCH_NOT_STARTED', `event ${ev.type} before MATCH_START`);
  }

  // Abort watch (STR/01 §9): fewer than 2 connected human players still alive →
  // remaining one wins by default / match aborted. Deferred while a reveal or
  // shot is mid-flight so the pending resolution completes on the wire.
  const isDriver =
    ev.type === 'BEGIN_TURNS' ||
    ev.type === 'PLAY' ||
    ev.type === 'LIAR' ||
    ev.type === 'STAGE' ||
    ev.type === 'TURN_TIMEOUT' ||
    ev.type === 'WINDOW_EXPIRE' ||
    ev.type === 'REVEAL_ACK' ||
    ev.type === 'SHOT_ACK' ||
    ev.type === 'NEXT_ROUND';
  if (isDriver && maybeAbort(s, ev.at, effects)) {
    reject('ERR_MATCH_OVER', 'match aborted (fewer than 2 players remain)');
  }

  switch (ev.type) {
    case 'MATCH_START':
      return handleMatchStart(s, ev, effects);
    case 'BEGIN_TURNS':
      return handleBeginTurns(s, ev, effects);
    case 'PLAY':
      return handlePlay(s, ev, effects);
    case 'LIAR':
      return handleLiar(s, ev, effects);
    case 'STAGE':
      return handleStage(s, ev, effects);
    case 'TURN_TIMEOUT':
      return handleTurnTimeout(s, ev, effects);
    case 'WINDOW_EXPIRE':
      return handleWindowExpire(s, ev, effects);
    case 'REVEAL_ACK':
      return handleRevealAck(s, ev, effects);
    case 'SHOT_ACK':
      return handleShotAck(s, ev, effects);
    case 'NEXT_ROUND':
      return handleNextRound(s, ev, effects);
    case 'DISCONNECT':
    case 'RECONNECT':
    case 'ABANDON':
    case 'LEAVE':
      return handlePresence(s, ev, effects);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Shared validators
// ─────────────────────────────────────────────────────────────────────────────

function seated(s: GameState, seat: number): PlayerState {
  const p = s.players.find((q) => q.seat === seat);
  if (!p) reject('ERR_NOT_SEATED', `seat ${seat} is not part of this match`);
  return p;
}

function requireActorRights(p: PlayerState): void {
  if (!p.alive) reject('ERR_DEAD', `seat ${p.seat} is dead (spectating)`);
  if (p.abandoned) reject('ERR_ABANDONED', `seat ${p.seat} abandoned the match`);
  if (p.disconnectedAt !== undefined) {
    reject('ERR_DISCONNECTED', `seat ${p.seat} is disconnected (reconnect to act)`);
  }
}

function resolveCards(hand: Card[], cardIds: string[]): Card[] {
  const selected: Card[] = [];
  for (const id of cardIds) {
    const card = hand.find((c) => c.id === id);
    if (!card) reject('ERR_NOT_OWNED_CARD', `card ${id} is not in the actor's hand`);
    if (selected.some((c) => c.id === id)) {
      reject('ERR_DUPLICATE_CARD', `card ${id} selected twice`);
    }
    selected.push(card);
  }
  return selected;
}

function requireRound(s: GameState): NonNullable<GameState['round']> {
  if (!s.round) reject('ERR_INTERNAL', 'round missing mid-match');
  return s.round;
}

function requireTurn(s: GameState): NonNullable<GameState['turn']> {
  if (!s.turn) reject('ERR_INTERNAL', 'turn missing in TURN/WINDOW phase');
  return s.turn;
}

// ─────────────────────────────────────────────────────────────────────────────
// Handlers
// ─────────────────────────────────────────────────────────────────────────────

function handleMatchStart(s: GameState, ev: { at: number }, effects: Effect[]): void {
  if (s.phase !== 'LOBBY') reject('ERR_WRONG_PHASE', `MATCH_START from ${s.phase}`);
  const eligible = s.players.filter((p) => !p.abandoned);
  if (eligible.length < 2) {
    reject('ERR_TOO_FEW_PLAYERS', `need ≥2 non-abandoned players, have ${eligible.length}`);
  }
  s.matchStartAt = ev.at;
  // Phase A steps 1–3 (research/02 §9): bullets + starter before the first deal.
  for (const p of s.players) {
    p.bulletPos = s.rng.int(1, 6);
  }
  const starter = eligible[s.rng.int(0, eligible.length - 1)];
  s.pendingStarter = starter.seat;
  effects.push({
    kind: 'MATCH_STARTED',
    seats: s.players.map((p) => p.seat),
    starterSeat: starter.seat,
  });
  effects.push(...startRound(s, 1, starter.seat));
}

function handleBeginTurns(s: GameState, ev: { at: number }, effects: Effect[]): void {
  if (s.phase !== 'ROUND_NEW') reject('ERR_WRONG_PHASE', `BEGIN_TURNS from ${s.phase}`);
  if (s.pendingStarter === null) reject('ERR_INTERNAL', 'BEGIN_TURNS without a pending starter');
  const starter = seated(s, s.pendingStarter);
  if (!starter.alive) reject('ERR_INTERNAL', 'pending starter is dead');
  s.turn = {
    seat: starter.seat,
    startedAt: ev.at,
    deadline: ev.at + turnTimerMs(s.config, alivePlayers(s).length),
  };
  s.pendingStarter = null;
  s.phase = 'TURN';
  effects.push({ kind: 'TURN_STARTED', seat: s.turn.seat, deadline: s.turn.deadline });
}

function handlePlay(s: GameState, ev: GameEvent & { type: 'PLAY' }, effects: Effect[]): void {
  if (s.phase !== 'TURN' && s.phase !== 'WINDOW') {
    reject('ERR_WRONG_PHASE', `PLAY from ${s.phase}`);
  }
  const p = seated(s, ev.seat);
  requireActorRights(p);
  const turn = requireTurn(s);
  if (ev.seat !== turn.seat)
    reject('ERR_NOT_YOUR_TURN', `not ${ev.seat}'s turn (it's ${turn.seat}'s)`);
  if (ev.cardIds.length < 1 || ev.cardIds.length > 3) {
    reject('ERR_INVALID_COUNT', `play ${ev.cardIds.length} cards is outside 1..3`);
  }
  const cards = resolveCards(p.hand, ev.cardIds);
  onPlay(s, { seat: ev.seat, cards, at: ev.at, effects, auto: undefined });
}

/**
 * Shared play pipeline (used by PLAY and TURN_TIMEOUT auto-play):
 *   1. previous play becomes unchallengeable → credit its bluff if it lied
 *   2. close any open window ("believed")
 *   3. append the play, update hand/staged
 *   4. holders == 1 → forced auto-LIAR (R29) → resolution
 *   5. else advance the turn (skip dead + empty) and open window mode's window
 */
interface OnPlayCtx {
  seat: number;
  cards: Card[];
  at: number;
  effects: Effect[];
  auto?: 'timeout' | 'disconnect';
}

function onPlay(s: GameState, o: OnPlayCtx): void {
  const round = requireRound(s);
  const p = seatOf(s, o.seat);

  const prev = round.pile[round.pile.length - 1];
  if (prev) creditBluffIfLie(s, prev);
  if (round.window) {
    o.effects.push({
      kind: 'WINDOW_CLOSED',
      reason: 'believed',
      accusedSeat: round.window.accusedSeat,
    });
    round.window = undefined;
  }

  const play: Play = { seq: ++s.playSeq, seat: o.seat, cards: o.cards, at: o.at };
  round.pile.push(play);
  const playedIds = new Set(o.cards.map((c) => c.id));
  p.hand = p.hand.filter((c) => !playedIds.has(c.id));
  p.staged = [];

  o.effects.push({
    kind: 'PLAYED',
    seat: o.seat,
    count: o.cards.length,
    pile: round.pile.map((pl) => ({ seat: pl.seat, count: pl.cards.length })),
    auto: o.auto,
  });

  const remaining = holders(s);
  if (remaining.length === 1) {
    // Forced auto-call (R29): the single holder must call LIAR on the play just
    // made.fires immediately, same-tick with the play (STR/07 §6 priority).
    if (remaining[0].seat === o.seat) {
      reject('ERR_INTERNAL', 'forced call: single holder cannot be the accused');
    }
    resolveChallenge(s, {
      challengerSeat: remaining[0].seat,
      accusedSeat: play.seat,
      play,
      forced: true,
      effects: o.effects,
    });
    return;
  }

  const aliveCount = alivePlayers(s).length;
  const nextSeat = nextHolderCcw(s, o.seat);
  s.turn = {
    seat: nextSeat,
    startedAt: o.at,
    deadline: o.at + turnTimerMs(s.config, aliveCount),
  };
  o.effects.push({ kind: 'TURN_STARTED', seat: nextSeat, deadline: s.turn.deadline });

  if (challengeModeFor(s.config, aliveCount) === 'open-window') {
    round.window = {
      playSeq: play.seq,
      accusedSeat: play.seat,
      openedAt: o.at,
      armedAt: o.at + s.config.armDelayMs,
      closesAt: o.at + s.config.windowMs,
    };
    s.phase = 'WINDOW';
    o.effects.push({
      kind: 'WINDOW_OPENED',
      playSeq: play.seq,
      accusedSeat: play.seat,
      openedAt: round.window.openedAt,
      armedAt: round.window.armedAt,
      closesAt: round.window.closesAt,
    });
  } else {
    s.phase = 'TURN';
  }
}

function handleLiar(s: GameState, ev: GameEvent & { type: 'LIAR' }, effects: Effect[]): void {
  if (s.phase !== 'TURN' && s.phase !== 'WINDOW') {
    reject('ERR_WRONG_PHASE', `LIAR from ${s.phase}`);
  }
  const p = seated(s, ev.seat);
  requireActorRights(p);
  const round = requireRound(s);
  const last = round.pile[round.pile.length - 1];
  if (!last) reject('ERR_FIRST_PLAY', 'LIAR is illegal on the first play of a round (R11)');
  // Can an empty-handed player challenge? In open-window mode yes ("ANY living
  // player except the accused", STR/01 §4); in next-only mode the turn-holder
  // always holds cards, so nothing extra to enforce here.

  let accusedSeat: number;
  let play: Play;
  if (s.phase === 'WINDOW') {
    const w = round.window;
    if (!w) reject('ERR_INTERNAL', 'WINDOW phase without window state');
    if (ev.accusedSeat !== undefined && ev.accusedSeat !== w.accusedSeat) {
      reject(
        'ERR_WRONG_ACCUSED',
        `LIAR aimed at seat ${ev.accusedSeat}, current window is ${w.accusedSeat}`,
      );
    }
    if (ev.seat === w.accusedSeat) {
      reject('ERR_SELF_CHALLENGE', 'the accused cannot challenge their own play');
    }
    if (ev.at < w.armedAt) {
      reject('ERR_WINDOW_NOT_ARMED', `CHECK before arm delay (${w.armedAt})`);
    }
    if (ev.at > w.closesAt) {
      reject('ERR_WINDOW_CLOSED', `CHECK after window close (${w.closesAt})`);
    }
    accusedSeat = w.accusedSeat;
    play = round.pile.find((pl) => pl.seq === w.playSeq) ?? last;
  } else {
    const aliveCount = alivePlayers(s).length;
    if (challengeModeFor(s.config, aliveCount) === 'open-window') {
      reject('ERR_WINDOW_CLOSED', 'challenge window already closed for that play');
    }
    const turn = requireTurn(s);
    if (ev.seat !== turn.seat) {
      reject('ERR_NOT_YOUR_TURN', `only the current turn player (${turn.seat}) may call LIAR`);
    }
    accusedSeat = last.seat;
    play = last;
    if (ev.seat === accusedSeat) {
      reject('ERR_SELF_CHALLENGE', 'the accused cannot challenge their own play');
    }
    if (ev.accusedSeat !== undefined && ev.accusedSeat !== accusedSeat) {
      reject(
        'ERR_WRONG_ACCUSED',
        `LIAR aimed at seat ${ev.accusedSeat}, last play is ${accusedSeat}'s`,
      );
    }
  }

  resolveChallenge(s, { challengerSeat: ev.seat, accusedSeat, play, forced: false, effects });
}

/**
 * Shot assignment per STR/01 §6 (A1 — owner's rule, allocated in `shot` below):
 *   false accuser → SELF, always
 *   caught liar   → fair coin: SELF or EXECUTE_BY_ACCUSER (executor = accuser)
 */
export function assignShotKind(loserRole: 'accused' | 'accuser', rng: RngPort): ShotKind {
  if (loserRole === 'accuser') return 'SELF';
  return rng.int(0, 1) === 1 ? 'EXECUTE_BY_ACCUSER' : 'SELF';
}

/**
 * Full challenge adjudication + shot assignment + deterministic pull (A1 §6).
 * ZERO RNG at pull time (Model A) — outcome fixed at match start.
 * Mutates `s`; pushes REVEALED + SHOT_ASSIGNED (+ WINDOW_CLOSED when open).
 */
function resolveChallenge(
  s: GameState,
  o: {
    challengerSeat: number;
    accusedSeat: number;
    play: Play;
    forced: boolean;
    effects: Effect[];
  },
): void {
  const round = requireRound(s);
  if (o.challengerSeat === o.accusedSeat) {
    reject('ERR_INTERNAL', 'challenger === accused');
  }
  const challenger = seatOf(s, o.challengerSeat);
  const lied = containsLie(o.play.cards, round.tableCard);
  const verdict = lied ? ('LIE' as const) : ('TRUTH' as const);
  if (lied) challenger.stats.catches += 1;
  else challenger.stats.falseAccusations += 1;

  const loserSeat = lied ? o.accusedSeat : o.challengerSeat;
  const loserRole = lied ? ('accused' as const) : ('accuser' as const);

  // Shot assignment (A1): false accuser → SELF always; caught liar → fair coin.
  const shotKind = assignShotKind(loserRole, s.rng);
  const executorSeat: number | undefined =
    shotKind === 'EXECUTE_BY_ACCUSER' ? o.challengerSeat : undefined;

  // The pull — always the loser's own revolver, fixed bulletPos (Model A).
  const loser = seatOf(s, loserSeat);
  const pullNo = loser.pulls + 1;
  loser.pulls = pullNo;
  const died = pullNo === loser.bulletPos; // bulletPos ∈ 1..6 ⇒ pull #6 is always fatal
  const outcome = died ? ('LIVE' as const) : ('BLANK' as const);
  if (died) {
    loser.alive = false;
    loser.stats.deaths = 1;
    loser.stats.deathCause = shotKind === 'EXECUTE_BY_ACCUSER' ? 'executed' : 'selfRoulette';
    if (shotKind === 'EXECUTE_BY_ACCUSER' && executorSeat !== undefined) {
      seatOf(s, executorSeat).stats.kills += 1; // EXECUTE where target died
    }
  } else {
    loser.stats.pullsSurvived += 1;
  }
  const dareDevil = !died && pullNo === 5; // survived the 50/50 chamber
  if (dareDevil) s.dareDevilMoments += 1;

  const deathCause = died
    ? shotKind === 'EXECUTE_BY_ACCUSER'
      ? ('executed' as const)
      : ('selfRoulette' as const)
    : undefined;
  const resolution: ChallengeResolution = {
    challengerSeat: o.challengerSeat,
    accusedSeat: o.accusedSeat,
    cards: o.play.cards,
    verdict,
    forced: o.forced,
    loserSeat,
    loserRole,
    shotKind,
    executorSeat,
    pullNo,
    outcome,
    died,
    deathCause,
    dareDevil,
  };
  round.resolution = resolution;

  if (round.window) {
    o.effects.push({
      kind: 'WINDOW_CLOSED',
      reason: 'challenged',
      accusedSeat: round.window.accusedSeat,
    });
    round.window = undefined;
  }
  s.turn = null;
  s.phase = 'REVEAL';

  o.effects.push({
    kind: 'REVEALED',
    challengerSeat: o.challengerSeat,
    accusedSeat: o.accusedSeat,
    cards: o.play.cards,
    verdict,
    loserSeat,
    forced: o.forced,
  });
  o.effects.push({ kind: 'SHOT_ASSIGNED', loserSeat, shotKind, executorSeat });
}

function handleStage(s: GameState, ev: GameEvent & { type: 'STAGE' }, _effects: Effect[]): void {
  if (s.phase !== 'TURN' && s.phase !== 'WINDOW') {
    reject('ERR_WRONG_PHASE', `STAGE from ${s.phase}`);
  }
  const p = seated(s, ev.seat);
  requireActorRights(p);
  if (ev.cardIds.length > 3) {
    reject('ERR_INVALID_COUNT', `staging ${ev.cardIds.length} cards is outside 0..3`);
  }
  resolveCards(p.hand, ev.cardIds); // validates ownership + distinctness; 0..3 allowed
  p.staged = ev.cardIds.slice();
}

/**
 * A4 timeout: auto-PLAY the pre-staged selection, else 1 random card.
 * NEVER auto-calls, NEVER auto-shoots. A disconnected seat is protected by the
 * 60s grace: no auto-play may fire before disconnectedAt + graceMs.
 */
function handleTurnTimeout(
  s: GameState,
  ev: GameEvent & { type: 'TURN_TIMEOUT' },
  effects: Effect[],
): void {
  if (s.phase !== 'TURN' && s.phase !== 'WINDOW') {
    reject('ERR_WRONG_PHASE', `TURN_TIMEOUT from ${s.phase}`);
  }
  const turn = requireTurn(s);
  if (ev.seat !== turn.seat) {
    reject('ERR_NOT_YOUR_TURN', `TURN_TIMEOUT for ${ev.seat}, but it's ${turn.seat}'s turn`);
  }
  const p = seatOf(s, ev.seat);
  if (ev.at < turn.deadline) reject('ERR_TOO_EARLY', 'turn timer has not expired');
  if (p.disconnectedAt !== undefined && ev.at < p.disconnectedAt + s.config.disconnectGraceMs) {
    reject('ERR_GRACE', 'disconnect grace (60s) has not elapsed');
  }
  if (p.hand.length === 0) reject('ERR_INTERNAL', 'turn-holder without cards');

  const stagedValid = p.staged.filter((id) => p.hand.some((c) => c.id === id));
  let cardIds: string[];
  if (stagedValid.length > 0) {
    cardIds = stagedValid;
  } else {
    const card = s.rng.pick(p.hand); // 1 random card (A4)
    cardIds = [card.id];
  }
  const cards = cardIds
    .map((id) => p.hand.find((c) => c.id === id))
    .filter((c): c is Card => c !== undefined);
  const auto: 'timeout' | 'disconnect' =
    p.disconnectedAt !== undefined || p.abandoned ? 'disconnect' : 'timeout';
  onPlay(s, { seat: ev.seat, cards, at: ev.at, effects, auto });
}

function handleWindowExpire(
  s: GameState,
  ev: GameEvent & { type: 'WINDOW_EXPIRE' },
  effects: Effect[],
): void {
  if (s.phase !== 'WINDOW') reject('ERR_WRONG_PHASE', `WINDOW_EXPIRE from ${s.phase}`);
  const round = requireRound(s);
  const w = round.window;
  if (!w) reject('ERR_INTERNAL', 'WINDOW phase without window state');
  if (ev.at < w.closesAt) reject('ERR_TOO_EARLY', 'window has not expired');
  const windowed = round.pile.find((pl) => pl.seq === w.playSeq);
  if (windowed) creditBluffIfLie(s, windowed); // unchallenged → the bluff (if any) stood
  effects.push({ kind: 'WINDOW_CLOSED', reason: 'expired', accusedSeat: w.accusedSeat });
  round.window = undefined;
  s.phase = 'TURN'; // the current turn-holder keeps their remaining time
}

function handleRevealAck(
  s: GameState,
  _ev: GameEvent & { type: 'REVEAL_ACK' },
  effects: Effect[],
): void {
  if (s.phase !== 'REVEAL') reject('ERR_WRONG_PHASE', `REVEAL_ACK from ${s.phase}`);
  const res = requireRound(s).resolution;
  if (!res) reject('ERR_INTERNAL', 'REVEAL phase without resolution');
  s.phase = 'SHOT';
  effects.push({
    kind: 'SHOT_RESULT',
    loserSeat: res.loserSeat,
    pullNo: res.pullNo,
    outcome: res.outcome,
    died: res.died,
    deathCause: res.deathCause,
  });
}

/**
 * After every roulette — blank or live — the round ends (R20/R25); then either
 * the match ends (last alive, R32) or ROUND_END holds the starter designation.
 */
function handleShotAck(
  s: GameState,
  ev: GameEvent & { type: 'SHOT_ACK' },
  effects: Effect[],
): void {
  if (s.phase !== 'SHOT') reject('ERR_WRONG_PHASE', `SHOT_ACK from ${s.phase}`);
  const round = requireRound(s);
  const res = round.resolution;
  if (!res) reject('ERR_INTERNAL', 'SHOT phase without resolution');

  for (const p of s.players) {
    if (p.alive) p.stats.roundsSurvived += 1; // "+1 coin per round survived" (STR/04 §2)
  }
  s.completedRounds += 1;

  effects.push({
    kind: 'ROUND_ENDED',
    roundNo: round.roundNo,
    reason: res.verdict === 'LIE' ? 'caught-liar' : 'false-accusation',
    loserSeat: res.loserSeat,
    survived: !res.died,
    dareDevil: res.dareDevil,
  });

  const aliveNow = alivePlayers(s);
  const presentNow = presentAlivePlayers(s);
  if (aliveNow.length === 1) {
    effects.push(finishMatch(s, aliveNow[0].seat, false, ev.at)); // R32 last alive
    return;
  }
  if (presentNow.length < 2) {
    // Deaths can strand alive-but-abandoned seats (auto-players): fewer than 2
    // connected humans remain → remaining/last wins by default (abort, STR/01 §9).
    effects.push(finishMatch(s, presentNow.length === 1 ? presentNow[0].seat : null, true, ev.at));
    return;
  }
  s.pendingStarter = computeNextStarter(s);
  s.phase = 'ROUND_END';
}

function handleNextRound(
  s: GameState,
  _ev: GameEvent & { type: 'NEXT_ROUND' },
  effects: Effect[],
): void {
  if (s.phase !== 'ROUND_END') reject('ERR_WRONG_PHASE', `NEXT_ROUND from ${s.phase}`);
  const round = requireRound(s);
  if (s.pendingStarter === null) reject('ERR_INTERNAL', 'NEXT_ROUND without pending starter');
  effects.push(...startRound(s, round.roundNo + 1, s.pendingStarter));
}

// ─────────────────────────────────────────────────────────────────────────────
// Presence / abandonment
// ─────────────────────────────────────────────────────────────────────────────

function handlePresence(
  s: GameState,
  ev: GameEvent & { type: 'DISCONNECT' | 'RECONNECT' | 'ABANDON' | 'LEAVE' },
  effects: Effect[],
): void {
  const p = seated(s, ev.seat);
  switch (ev.type) {
    case 'DISCONNECT':
      if (p.disconnectedAt === undefined) p.disconnectedAt = ev.at;
      break;
    case 'RECONNECT':
      delete p.disconnectedAt;
      break;
    case 'ABANDON': {
      if (p.disconnectedAt === undefined) {
        reject('ERR_NOT_DISCONNECTED', 'seat is not disconnected');
      }
      if (p.abandoned) break; // idempotent
      if (ev.at < p.disconnectedAt + s.config.disconnectGraceMs) {
        reject('ERR_TOO_EARLY', 'grace has not elapsed');
      }
      p.abandoned = true; // seat lost ("drunk under the table" — not eliminated)
      break;
    }
    case 'LEAVE':
      if (p.left) break; // idempotent
      p.left = true;
      p.abandoned = true;
      if (p.disconnectedAt === undefined) p.disconnectedAt = ev.at;
      break;
  }
  effects.push({
    kind: 'PRESENCE',
    seat: p.seat,
    connected: p.disconnectedAt === undefined && !p.left,
    abandoned: p.abandoned,
  });
  // A leave/abandon may drop the match below 2 connected alive players → abort.
  maybeAbort(s, ev.at, effects);
}

// ─────────────────────────────────────────────────────────────────────────────
// Small internals
// ─────────────────────────────────────────────────────────────────────────────

function creditBluffIfLie(s: GameState, play: Play): void {
  const round = requireRound(s);
  if (containsLie(play.cards, round.tableCard)) {
    seatOf(s, play.seat).stats.bluffSuccesses += 1; // ≥1 lie, unchallenged & un-revealed
  }
}

/** True iff the abort condition now holds (STR/01 §9); when it fires, the match
 *  ends: the surviving connected player wins by default, or no winner if none. */
function maybeAbort(s: GameState, at: number, effects: Effect[]): boolean {
  const phases: GameState['phase'][] = ['TURN', 'WINDOW', 'ROUND_NEW', 'ROUND_END'];
  if (!phases.includes(s.phase)) return false;
  const present = presentAlivePlayers(s);
  if (present.length >= 2) return false;
  effects.push(finishMatch(s, present.length === 1 ? present[0].seat : null, true, at));
  return true;
}
