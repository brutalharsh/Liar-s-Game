/**
 * Test helpers: seeded deterministic matches, white-box state overrides,
 * and scripting conveniences. Tests are free to reach into state directly
 * (the engine is in-package); `withHands`/`withBullets` clone before mutating.
 */
import { apply, cloneState, createMatch } from '../src/engine';
import type { ApplyResult, Card, GameEvent, GameState, PlayerState, Rank, RosterEntry } from '../src/types';

export const BASE_SEED = 20261123;
/** Fake epoch base (ms) — all scripted times are offsets from this. */
export const T0 = 1_000_000;

export function roster(n: number): RosterEntry[] {
  return Array.from({ length: n }, (_, seat) => ({
    seat,
    accountId: `acc-${seat}`,
    nickname: `P${seat}`,
  }));
}

/** createMatch without any events (phase LOBBY). */
export function emptyMatch(n: number, seed = BASE_SEED): GameState {
  return createMatch({ roster: roster(n), matchId: 'm-test', roomCode: 'ABCDE', seed });
}

/** Fresh match taken through MATCH_START + BEGIN_TURNS (phase = TURN). */
export function startedMatch(n: number, seed = BASE_SEED, at = T0): GameState {
  const s0 = emptyMatch(n, seed);
  const s1 = apply(s0, { type: 'MATCH_START', at }).state;
  return apply(s1, { type: 'BEGIN_TURNS', at: at + 1 }).state;
}

/** apply() + assert acceptance. Returns the new state. */
export function ok(s: GameState, ev: GameEvent): { s: GameState; effects: ApplyResult['effects'] } {
  const r = apply(s, ev);
  if (r.err) throw new Error(`expected accept, got ${r.err.code}: ${r.err.message} (event ${ev.type})`);
  return { s: r.state, effects: r.effects };
}

export function rejected(s: GameState, ev: GameEvent, code?: string): GameState {
  const r = apply(s, ev);
  if (!r.err) throw new Error(`expected rejection of ${ev.type}, was accepted`);
  if (code && r.err.code !== code) {
    throw new Error(`expected ${code}, got ${r.err.code}: ${r.err.message}`);
  }
  return r.state;
}

export function player_(s: GameState, seat: number): PlayerState {
  const p = s.players.find((q) => q.seat === seat);
  if (!p) throw new Error(`no seat ${seat}`);
  return p;
}

/** Builds unique cards for a seat from rank strings ("K","Q","A","JOKER"). */
export function cardsFor(seat: number, ranks: string[]): Card[] {
  const seen = new Map<string, number>();
  return ranks.map((rank) => {
    const i = (seen.get(rank) ?? 0) + 1;
    seen.set(rank, i);
    return { id: `x${seat}-${rank}${i}`, rank: rank as Rank };
  });
}

/** White-box: replace hands (clone-on-write). Keys = seats. */
export function withHands(s: GameState, hands: Record<number, string[]>): GameState {
  const c = cloneState(s);
  for (const [seatS, ranks] of Object.entries(hands)) {
    const seat = Number(seatS);
    player_(c, seat).hand = cardsFor(seat, ranks);
  }
  return c;
}

/** White-box: set bulletPos per seat (clone-on-write). */
export function withBullets(s: GameState, bullets: Record<number, number>): GameState {
  const c = cloneState(s);
  for (const [seatS, pos] of Object.entries(bullets)) {
    player_(c, Number(seatS)).bulletPos = pos;
  }
  return c;
}

export function handIds(s: GameState, seat: number): string[] {
  return player_(s, seat).hand.map((c) => c.id);
}

/** Play the given ids for the turn-holder at time `at`. */
export function evPlay(seat: number, ids: string[], at: number): GameEvent {
  return { type: 'PLAY', seat, cardIds: ids, at };
}

/** The seat whose turn it is (phase TURN/WINDOW). */
export function turnSeat(s: GameState): number {
  if (!s.turn) throw new Error('no turn');
  return s.turn.seat;
}

/** Fully resolve a challenge chain: REVEAL_ACK → SHOT_ACK effect pair. */
export function drainResolution(s: GameState, at: number): { s: GameState; shot: ApplyResult['effects'] } {
  const r1 = ok(s, { type: 'REVEAL_ACK', at });
  const shot = r1.effects.filter((e) => e.kind === 'SHOT_RESULT');
  const r2 = ok(r1.s, { type: 'SHOT_ACK', at });
  return { s: r2.s, shot };
}

/** Walk into the next round's first turn (NEXT_ROUND → BEGIN_TURNS). */
export function nextRoundTurn(s: GameState, at: number): GameState {
  const r1 = ok(s, { type: 'NEXT_ROUND', at });
  const r2 = ok(r1.s, { type: 'BEGIN_TURNS', at });
  return r2.s;
}

/** All effects of a kind across an apply result list. */
export function ofKind<T extends { kind: string }>(effects: T[], kind: string): T[] {
  return effects.filter((e) => (e as { kind: string }).kind === kind) as T[];
}
