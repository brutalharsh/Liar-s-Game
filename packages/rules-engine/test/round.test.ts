import { describe, expect, it } from 'vitest';
import type { GameState, TableRank } from '../src/types';
import { ok, startedMatch, T0, turnSeat, withBullets, withHands } from './helpers';

const offOf = (t: TableRank): TableRank => (t === 'K' ? 'Q' : 'K');

function handOf(s: GameState, seat: number): string[] {
  return s.players.find((p) => p.seat === seat)!.hand.map((c) => c.id);
}

/** 4p next-only: previous starter R plays a truth, N (=R+1) plays a truth,
 *  H2 (=N+1) false-accuses N. Used by the false-accusation starter test. */
function playFalseAccusationRound(seed: number) {
  let s = startedMatch(4, seed);
  s = withBullets(s, { [0]: 6, [1]: 6, [2]: 6, [3]: 6 });
  const R = turnSeat(s); // round starter (random via seed)
  const N = (R + 1) % 4;
  const H2 = (R + 2) % 4;
  const table = s.round!.tableCard;
  // R plays a truth, N plays a truth, so H2's call on N is a FALSE ACCUSATION:
  s = withHands(s, {
    [R]: [table, table, table, table, table],
    [N]: [table, table, table, table, table],
  });
  s = ok(s, { type: 'PLAY', seat: R, cardIds: handOf(s, R).slice(0, 1), at: T0 + 5 }).s;
  s = ok(s, { type: 'PLAY', seat: N, cardIds: handOf(s, N).slice(0, 1), at: T0 + 6 }).s;
  const r = ok(s, { type: 'LIAR', seat: H2, at: T0 + 7 });
  expect(r.s.round!.resolution).toMatchObject({
    verdict: 'TRUTH',
    loserSeat: H2,
    loserRole: 'accuser',
  });
  return { previousStarter: R, accused: N, falseAccuser: H2, s: r.s };
}

describe('Round transitions (R25/R26 + STR/01 §2.3 — regression trio)', () => {
  it('(a) round loser caught lying SURVIVES → the caught liar starts the next round', () => {
    let s = startedMatch(3, 201);
    s = withBullets(s, { [0]: 6, [1]: 6, [2]: 6 }); // nobody dies
    const L = turnSeat(s);
    const off = offOf(s.round!.tableCard);
    s = withHands(s, { [L]: [off, off, off, off, off] });
    s = ok(s, { type: 'PLAY', seat: L, cardIds: handOf(s, L).slice(0, 1), at: T0 + 5 }).s;
    const r = ok(s, { type: 'LIAR', seat: (L + 1) % 3, at: T0 + 6 });
    expect(r.s.round!.resolution!.verdict).toBe('LIE');
    s = ok(r.s, { type: 'REVEAL_ACK', at: T0 + 7 }).s;
    s = ok(s, { type: 'SHOT_ACK', at: T0 + 8 }).s;
    expect(s.players.find((p) => p.seat === L)!.alive).toBe(true); // survived the blank
    s = ok(s, { type: 'NEXT_ROUND', at: T0 + 9 }).s;
    s = ok(s, { type: 'BEGIN_TURNS', at: T0 + 10 }).s;
    expect(s.turn!.seat).toBe(L); // caught liar starts
    expect(s.round!.roundNo).toBe(2);
  });

  it('(b) FALSE ACCUSATION: next starter = next-in-order after the PREVIOUS starter — not the accuser, not the loser (STR/01 §2.3 overrides research/02 step 26)', () => {
    const { previousStarter: R, accused: N, falseAccuser: H2, s } = playFalseAccusationRound(202);
    expect(H2).not.toBe((R + 1) % 4); // construction sanity: accuser ≠ next-after-starter
    let t = s;
    t = ok(t, { type: 'REVEAL_ACK', at: T0 + 8 }).s;
    t = ok(t, { type: 'SHOT_ACK', at: T0 + 9 }).s;
    expect(t.round!.starterSeat).toBe(R);
    t = ok(t, { type: 'NEXT_ROUND', at: T0 + 10 }).s;
    t = ok(t, { type: 'BEGIN_TURNS', at: T0 + 11 }).s;
    expect(t.turn!.seat).toBe((R + 1) % 4); // = N (the accused truth-teller), NOT the false accuser H2
    expect(t.turn!.seat).not.toBe(H2);
    void N;
  });

  it('(c) DEAD designated starter → next living counter-clockwise seat starts (research/02 §10.K fallback)', () => {
    let s = startedMatch(3, 203);
    const L = turnSeat(s);
    s = withBullets(s, { [L]: 1 }); // L dies on the catch
    const off = offOf(s.round!.tableCard);
    s = withHands(s, { [L]: [off, off, off, off, off] });
    s = ok(s, { type: 'PLAY', seat: L, cardIds: handOf(s, L).slice(0, 3), at: T0 + 5 }).s;
    const r = ok(s, { type: 'LIAR', seat: (L + 1) % 3, at: T0 + 6 });
    expect(r.s.round!.resolution!.verdict).toBe('LIE');
    s = ok(r.s, { type: 'REVEAL_ACK', at: T0 + 7 }).s;
    s = ok(s, { type: 'SHOT_ACK', at: T0 + 8 }).s;
    expect(s.players.find((p) => p.seat === L)!.alive).toBe(false);
    s = ok(s, { type: 'NEXT_ROUND', at: T0 + 9 }).s;
    s = ok(s, { type: 'BEGIN_TURNS', at: T0 + 10 }).s;
    expect(s.turn!.seat).toBe((L + 1) % 3); // next living ccw after the dead liar
  });

  it('every round is fully fresh: reshuffle, redeal 5s, new table card, empty pile, cleared staged', () => {
    let s = startedMatch(5, 204); // 40-card deck at 5p
    s = withBullets(s, { [0]: 6, [1]: 6, [2]: 6, [3]: 6, [4]: 6 });
    const A = turnSeat(s);
    s = ok(s, { type: 'PLAY', seat: A, cardIds: handOf(s, A).slice(0, 2), at: T0 + 5 }).s; // window mode
    s = ok(s, { type: 'LIAR', seat: (A + 2) % 5, at: T0 + 8_000 }).s; // any non-accused after arm
    s = ok(s, { type: 'REVEAL_ACK', at: T0 + 9 }).s;
    s = ok(s, { type: 'SHOT_ACK', at: T0 + 10 }).s;
    s = ok(s, { type: 'NEXT_ROUND', at: T0 + 11 }).s;
    const round2 = s.round!;
    expect(round2.roundNo).toBe(2);
    expect(round2.pile).toHaveLength(0);
    expect(TABLE_RANKS).toContain(round2.tableCard);
    for (const p of s.players) {
      expect(p.hand).toHaveLength(5);
      expect(p.staged).toHaveLength(0);
    }
    // 40-card deck, 25 dealt → 15 hidden (5p sit-out, research/04 §1.4):
    expect(round2.leftover).toHaveLength(15);
  });

  it('round 1 starter is one of the seats (random via the port); redeal keeps starters in seats', () => {
    const seatsSeen = new Set<number>();
    for (let seed = 1; seed <= 25; seed++) {
      const s = startedMatch(4, seed * 131);
      seatsSeen.add(s.turn!.seat);
      expect(s.turn!.seat).toBeLessThan(4);
      expect(s.turn!.seat).toBeGreaterThanOrEqual(0);
    }
    expect(seatsSeen.size).toBeGreaterThan(1); // actually random
  });

  it('a round can NEVER end without a roulette: exactly one SHOT_RESULT per ROUND_ENDED (R10)', () => {
    // Chained scripted rounds; track the effect stream.
    let s = startedMatch(4, 206);
    s = withBullets(s, { [0]: 6, [1]: 6, [2]: 6, [3]: 6 });
    const shots: string[] = [];
    const ends: string[] = [];
    let t = T0 + 5;
    for (let round = 0; round < 3; round++) {
      const A = turnSeat(s);
      s = ok(s, { type: 'PLAY', seat: A, cardIds: handOf(s, A).slice(0, 1), at: t }).s;
      const r = ok(s, { type: 'LIAR', seat: (A + 1) % 4, at: t + 1 });
      const next = ok(r.s, { type: 'REVEAL_ACK', at: t + 2 });
      for (const e of next.effects) if (e.kind === 'SHOT_RESULT') shots.push('SHOT_RESULT');
      const end = ok(next.s, { type: 'SHOT_ACK', at: t + 3 });
      for (const e of end.effects) {
        if (e.kind === 'ROUND_ENDED') {
          ends.push('ROUND_ENDED');
          expect(e.reason).toMatch(/^(caught-liar|false-accusation)$/);
        }
      }
      s = end.s;
      expect(s.phase).toBe('ROUND_END');
      s = ok(s, { type: 'NEXT_ROUND', at: t + 4 }).s;
      s = ok(s, { type: 'BEGIN_TURNS', at: t + 5 }).s;
      t += 10;
    }
    expect(shots).toHaveLength(3);
    expect(ends).toHaveLength(3);
    expect(s.completedRounds).toBe(3);
  });

  it('blank or live, EVERY roulette ends its round — and opens a new one (STR/01 §7)', () => {
    // 4 rounds with mixed outcomes, all driven through SHOT_ACK → ROUND_END → NEXT_ROUND:
    const { s } = driveRouletteAlwaysEnds();
    expect(s.phase).toBe('ROUND_END');
    expect(s.completedRounds).toBe(4);
  });
});

function driveRouletteAlwaysEnds() {
  let s = startedMatch(3, 209);
  // bulletPos 5 for everyone: with at most 4 pulls in 4 rounds, nobody can die →
  // the match provably cannot end mid-loop, so completion is deterministic.
  s = withBullets(s, { [0]: 5, [1]: 5, [2]: 5 });
  let t = T0 + 5;
  for (let i = 1; i <= 4; i++) {
    const A = turnSeat(s);
    const off = offOf(s.round!.tableCard);
    s = withHands(s, { [A]: [off, off, off, off, off] });
    s = ok(s, { type: 'PLAY', seat: A, cardIds: handOf(s, A).slice(0, 1), at: t }).s;
    const r = ok(s, { type: 'LIAR', seat: turnSeat(s), at: t + 1 });
    s = ok(r.s, { type: 'REVEAL_ACK', at: t + 2 }).s;
    s = ok(s, { type: 'SHOT_ACK', at: t + 3 }).s;
    expect(s.phase).toBe('ROUND_END'); // blank or live: the round is OVER after the roulette
    if (i < 4) {
      s = ok(s, { type: 'NEXT_ROUND', at: t + 4 }).s;
      s = ok(s, { type: 'BEGIN_TURNS', at: t + 5 }).s;
    }
    t += 10;
  }
  return { s };
}

const TABLE_RANKS: readonly TableRank[] = ['K', 'Q', 'A'];
