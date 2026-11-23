/**
 * Round lifecycle + match termination helpers.
 *
 * Implements research/02 §9 phases B (round start), F (round transition incl.
 * starter rule, R26 + STR/01 §2.3), E steps 24 (win detection), and the
 * STR/09 MatchRecord emission.
 *
 * Starter rule (STR/01 §2.3 — overrides research/02 §9 step 26 per STR/00):
 *   round 1 → random (among non-abandoned seats)
 *   later   → the player caught lying last; else next living counter-
 *             clockwise seat after the PREVIOUS round's starter.
 *   dead designated starter → next living ccw seat after them (R26 fallback).
 */
import { buildDeck, dealHands, deckModulesFor, tableDeckRanks } from './deck';
import type {
  Effect,
  GameState,
  LogEntry,
  MatchRecord,
  Play,
  PlayerState,
  RoundState,
} from './types';

export function seatOf(s: GameState, seat: number): PlayerState {
  const p = s.players.find((q) => q.seat === seat);
  if (!p) throw new Error(`seatOf: no seat ${seat}`);
  return p;
}

export function alivePlayers(s: GameState): PlayerState[] {
  return s.players.filter((p) => p.alive);
}

/** Seats that can still act AND are still at the table (connected humans). STR/01 §9. */
export function presentAlivePlayers(s: GameState): PlayerState[] {
  return s.players.filter((p) => p.alive && !p.abandoned);
}

/** Next living seat strictly counter-clockwise after `fromSeat` (seat +1 = ccw). */
export function nextLivingCcw(s: GameState, fromSeat: number): number {
  for (let i = 1; i <= s.capacity; i++) {
    const seat = (fromSeat + i) % s.capacity;
    if (seatOf(s, seat).alive) return seat;
  }
  throw new Error('nextLivingCcw: no living player');
}

/** Next living card-holding seat ccw after `fromSeat` (R27/R28 skips). */
export function nextHolderCcw(s: GameState, fromSeat: number): number {
  for (let i = 1; i <= s.capacity; i++) {
    const seat = (fromSeat + i) % s.capacity;
    const p = seatOf(s, seat);
    if (p.alive && p.hand.length > 0) return seat;
  }
  throw new Error('nextHolderCcw: no holder remains (holders==1 invariant violated)');
}

/** Living players who still hold cards. */
export function holders(s: GameState): PlayerState[] {
  return s.players.filter((p) => p.alive && p.hand.length > 0);
}

/**
 * Begins a fully fresh round (R25): rebuild + shuffle the deck for this table
 * size, draw a new table card (R3 uniform), deal 5 to each living player
 * (R5), leftovers stay hidden. Increments roundsPlayed for the living.
 * Mutates `s`; returns the broadcast effects.
 */
export function startRound(s: GameState, roundNo: number, starterSeat: number): Effect[] {
  if (alivePlayers(s).length < 2) {
    throw new Error(`startRound: need ≥2 alive, have ${alivePlayers(s).length}`);
  }
  const alive = alivePlayers(s);
  const deck = s.rng.shuffle(buildDeck(deckModulesFor(s.capacity)));
  const tableCard = s.rng.pick(tableDeckRanks());
  const { hands, leftover } = dealHands(
    deck,
    alive.map((p) => p.seat),
  );

  const round: RoundState = {
    roundNo,
    starterSeat,
    tableCard,
    pile: [] as Play[],
    leftover,
  };
  s.round = round;
  s.phase = 'ROUND_NEW';

  for (const p of s.players) {
    p.staged = [];
    if (!p.alive) {
      p.hand = []; // dead players spectate; no stale hidden hands linger (STR/07 §3 hygiene)
      continue;
    }
    p.stats.roundsPlayed += 1;
  }
  for (const h of hands) {
    const p = seatOf(s, h.seat) as PlayerState; // hands are built for alive seats ascending
    p.hand = h.cards;
  }

  const effects: Effect[] = [
    {
      kind: 'ROUND_STARTED',
      roundNo,
      tableCard,
      dealtCounts: hands.map((h) => ({ seat: h.seat, count: h.cards.length })),
      deckSize: deck.length,
      leftoverCount: leftover.length,
    },
    ...hands.map((h): Effect => ({ kind: 'HAND_DEALT', seat: h.seat, cards: h.cards })),
  ];
  return effects;
}

/**
 * Starter for the round after the one in `s.round` (which must have a
 * resolution). STR/01 §2.3; dead-starter fallback per research/02 §10.K.
 */
export function computeNextStarter(s: GameState): number {
  const round = s.round;
  if (!round || !round.resolution) throw new Error('computeNextStarter: no resolved round');
  const res = round.resolution;
  let designated: number;
  if (res.verdict === 'LIE') {
    // Caught liar starts (STR/01 §2.3 / research/02 R26 primary).
    designated = res.accusedSeat;
  } else {
    // No liar was caught (false accusation): next in order after previous starter.
    designated = nextLivingCcw(s, round.starterSeat);
  }
  if (!seatOf(s, designated).alive) {
    designated = nextLivingCcw(s, designated);
  }
  return designated;
}

/**
 * Ends the match: fills `won`/`xpEarned`/`coinsEarned` (winner randInt 2..7 +
 * everyone +1 per survived round — STR/04 §2; random part via the RNG port),
 * builds the STR/09 MatchRecord, sets phase GAME_END. Mutates `s`.
 */
export function finishMatch(
  s: GameState,
  winnerSeat: number | null,
  aborted: boolean,
  at: number,
): Effect {
  s.phase = 'GAME_END';
  s.winnerSeat = winnerSeat;
  s.aborted = aborted;
  s.endAt = at;
  s.turn = null;
  if (s.round) {
    s.round.window = undefined;
  }

  const totalPulls = s.players.reduce((sum, p) => sum + p.pulls, 0);
  for (const p of s.players) {
    p.stats.won = p.seat === winnerSeat;
    if (!p.alive) {
      p.stats.xpEarned = 4; // XP: died (STR/04 §5)
    } else if (p.stats.won) {
      p.stats.xpEarned = 12; // XP: win
    } else if (p.abandoned || p.left) {
      p.stats.xpEarned = 0; // left mid-match: no completion credit
    } else {
      p.stats.xpEarned = 6; // XP: survived to the end
    }
    p.stats.coinsEarned = p.stats.roundsSurvived + (p.stats.won ? s.rng.int(2, 7) : 0);
  }

  const record: MatchRecord = {
    matchId: s.matchId,
    roomCode: s.roomCode,
    theme: s.theme,
    startedAt: s.matchStartAt,
    endedAt: at,
    capacity: s.capacity,
    players: s.players.map((p) => ({
      seat: p.seat,
      accountId: p.accountId,
      nickname: p.nickname,
      avatarSpec: p.avatarSpec,
      titleAtPlay: p.titleAtPlay,
      stats: p.stats,
    })),
    summary: {
      rounds: s.completedRounds,
      totalPulls,
      dareDevilMoments: s.dareDevilMoments,
    },
    winnerSeat,
    aborted,
  };
  s.matchRecord = record;
  return { kind: 'GAME_OVER', winnerSeat, aborted, record };
}

/** True when a match has begun (MATCH_START processed) and not ended. */
export function isMatchLive(s: GameState): boolean {
  return s.phase !== 'LOBBY' && s.phase !== 'GAME_END';
}

/** Rebuildable log view for persistence (doc-14 task 111 hash-chain input). */
export function logEnvelope(s: GameState): {
  matchId?: string;
  roomCode?: string;
  capacity: number;
  initialSeed: number | null;
  log: LogEntry[];
} {
  return {
    matchId: s.matchId,
    roomCode: s.roomCode,
    capacity: s.capacity,
    initialSeed: s.initialSeed,
    log: s.log,
  };
}
