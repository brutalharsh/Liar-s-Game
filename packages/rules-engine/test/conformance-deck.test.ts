/**
 * STR/01 §1 conformance — equipment composition & revolver minting (A9 audit).
 *
 * deck.test pins buildDeck(m) for m = 1..3 and deckModulesFor for eight player
 * counts. What is NOT yet pinned, and pinned here:
 *   - the COMPOSED law for EVERY N = 2..10 (N=6 is missing from the old table):
 *     m = ceil(N/4), deck = m × (6K + 6Q + 6A + 2 Jokers), 40% truths;
 *   - the table deck is exactly one K / one Q / one A — a Joker can never be
 *     the Table Card (STR/01 §1 "Table deck");
 *   - bulletPos is minted via rng.int(1, 6) at MATCH START for every seat,
 *     deterministically per seed, and — §1 "Not re-rolled. Not reset." — no
 *     further int(1, 6) mint ever happens, across reshuffles, redeals and
 *     deaths (revolver.test pins the pull ladder; this pins the MINT).
 */
import { describe, expect, it } from 'vitest';
import { apply, createMatch } from '../src/engine';
import { buildDeck, deckModulesFor, isTruth, tableDeckRanks } from '../src/deck';
import { SeededRng } from '../src/rng';
import type { RngPort } from '../src/rng';
import type { GameState } from '../src/types';
import { handIds, ok, roster, startedMatch, T0, turnSeat } from './helpers';

const rankCount = (deck: ReturnType<typeof buildDeck>, rank: string): number =>
  deck.filter((c) => c.rank === rank).length;

/** Injected port that records every int(min,max) call the engine makes. */
class RecordingRng implements RngPort {
  readonly intCalls: { min: number; max: number; out: number }[] = [];
  constructor(private readonly inner: RngPort) {}
  int(minInclusive: number, maxInclusive: number): number {
    const out = this.inner.int(minInclusive, maxInclusive);
    this.intCalls.push({ min: minInclusive, max: maxInclusive, out });
    return out;
  }
  pick<T>(items: readonly T[]): T {
    return this.inner.pick(items);
  }
  shuffle<T>(items: readonly T[]): T[] {
    return this.inner.shuffle(items);
  }
  /** Only the bullet-mint call shape: uniform int(1, 6). */
  mintCalls(): { min: number; max: number; out: number }[] {
    return this.intCalls.filter((c) => c.min === 1 && c.max === 6);
  }
}

describe('STR/01 §1 — deck composition for every N = 2..10 (A3)', () => {
  it.each([
    [2, 1],
    [3, 1],
    [4, 1],
    [5, 2],
    [6, 2],
    [7, 2],
    [8, 2],
    [9, 3],
    [10, 3],
  ])('N=%i players → m=%i: deck is m × (6K+6Q+6A+2 Jokers), 40% truths', (n, m) => {
    expect(deckModulesFor(n)).toBe(m);
    expect(m).toBe(Math.ceil(n / 4));
    const deck = buildDeck(deckModulesFor(n));
    expect(deck).toHaveLength(20 * m);
    expect(rankCount(deck, 'K')).toBe(6 * m);
    expect(rankCount(deck, 'Q')).toBe(6 * m);
    expect(rankCount(deck, 'A')).toBe(6 * m);
    expect(rankCount(deck, 'JOKER')).toBe(2 * m);
    expect(new Set(deck.map((c) => c.id)).size).toBe(20 * m);
    for (const table of ['K', 'Q', 'A'] as const) {
      expect(deck.filter((c) => isTruth(c, table)).length / deck.length).toBe(0.4);
    }
  });

  it('table deck: exactly 1 K / 1 Q / 1 A — a Joker can never be the Table Card', () => {
    expect(tableDeckRanks()).toEqual(['K', 'Q', 'A']);
  });
});

describe('STR/01 §1 — revolver mint (uniform 1..6 at match start, never re-rolled)', () => {
  it('MATCH_START mints every bulletPos through rng.int(1,6) before any other draw', () => {
    const rng = new RecordingRng(new SeededRng(771));
    const r = apply(createMatch({ roster: roster(3), matchId: 'm-mint', rng }), {
      type: 'MATCH_START',
      at: T0,
    });
    expect(r.err).toBeUndefined();
    const mints = rng.intCalls.slice(0, 3);
    expect(mints.map((c) => [c.min, c.max])).toEqual([
      [1, 6],
      [1, 6],
      [1, 6],
    ]);
    expect(r.state.players.map((p) => p.bulletPos)).toEqual(mints.map((c) => c.out));
  });

  it('minting is deterministic per seed, always within 1..6, and covers all six chambers', () => {
    const tally = new Map<number, number>();
    for (let seed = 1; seed <= 240; seed++) {
      const a = startedMatch(3, seed).players.map((p) => p.bulletPos);
      const b = startedMatch(3, seed).players.map((p) => p.bulletPos);
      expect(b).toEqual(a); // same seed → same mint stream
      for (const v of a) {
        expect(v).toBeGreaterThanOrEqual(1);
        expect(v).toBeLessThanOrEqual(6);
        tally.set(v, (tally.get(v) ?? 0) + 1);
      }
    }
    // 240 seeds × 3 seats = 720 mints; uniform mean = 16.7%/chamber. The
    // bounds are ±~6σ of the binomial — asserts "uniform 1–6" without flakes.
    for (let face = 1; face <= 6; face++) {
      const share = (tally.get(face) ?? 0) / 720;
      expect(share).toBeGreaterThan(0.1);
      expect(share).toBeLessThan(0.25);
    }
  });

  it('no re-mint across reshuffles, redeals and deaths: int(1,6) fires exactly N times, bulletPos is constant', () => {
    const rng = new RecordingRng(new SeededRng(772));
    let s = apply(createMatch({ roster: roster(3), matchId: 'm-mint', rng }), {
      type: 'MATCH_START',
      at: T0,
    }).state;
    s = apply(s, { type: 'BEGIN_TURNS', at: T0 + 1 }).state;
    const minted = s.players.map((p) => p.bulletPos);
    expect(rng.mintCalls()).toHaveLength(3);

    // Full round: a play, a challenge, a roulette (deaths allowed), a redeal.
    const playAndCall = (st: GameState, t: number): GameState => {
      let cur = ok(st, {
        type: 'PLAY',
        seat: turnSeat(st),
        cardIds: handIds(st, turnSeat(st)).slice(0, 1),
        at: t,
      }).s;
      cur = ok(cur, { type: 'LIAR', seat: turnSeat(cur), at: t + 1 }).s; // 3p → next-only
      cur = ok(cur, { type: 'REVEAL_ACK', at: t + 2 }).s;
      return ok(cur, { type: 'SHOT_ACK', at: t + 3 }).s;
    };

    s = playAndCall(s, T0 + 10); // round 1 roulette
    expect(s.players.map((p) => p.bulletPos)).toEqual(minted);
    expect(rng.mintCalls()).toHaveLength(3);
    expect(s.phase).toBe('ROUND_END'); // 3 alive, one pull → ≥2 remain

    s = ok(s, { type: 'NEXT_ROUND', at: T0 + 20 }).s; // full reshuffle + redeal
    s = ok(s, { type: 'BEGIN_TURNS', at: T0 + 21 }).s;
    s = playAndCall(s, T0 + 30); // round 2 roulette (may kill the 2nd-to-last)
    expect(s.players.map((p) => p.bulletPos)).toEqual(minted); // dead seats included
    expect(rng.mintCalls()).toHaveLength(3); // still exactly the match-start mints
  });
});
