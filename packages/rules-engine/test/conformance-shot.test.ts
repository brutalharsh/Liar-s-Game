/**
 * STR/01 §6 + §2.3 conformance — the false-accuser shot path, end to end.
 *
 * revolver.test pins the caught-liar ladder and the assignShotKind unit;
 * stats.test pins one false-accuser death. NOT yet pinned, pinned here:
 *   - a SERIAL false accuser (6 rounds): SHOT_ASSIGNED is SELF every time,
 *     executorSeat never set, nobody else's revolver ever fires, no kills
 *     are credited, pulls climb 1..5 as blanks and death lands exactly on
 *     the CERTAIN 6th pull ("same revolver odds in every path");
 *   - §2.3 TRUTH-branch starter chain: each false accusation moves the next
 *     starter to ccw(previous starter) — asserted for 6 straight rounds;
 *   - the dead-designated fallback on the TRUTH branch: a next-in-order
 *     accuser who dies hands the start to the seat past them (R26 analog).
 */
import { describe, expect, it } from 'vitest';
import type { Effect, GameState } from '../src/types';
import { handIds, ok, startedMatch, T0, turnSeat, withBullets, withHands } from './helpers';

function findEffect<T extends Effect['kind']>(effects: Effect[], kind: T) {
  return effects.find((e) => e.kind === kind) as Extract<Effect, { kind: T }> | undefined;
}

/** Deterministic seed search: first seed whose round-1 starter is `want`. */
function seedWithStarter(n: number, want: number): GameState {
  for (let seed = 8_000; seed < 9_000; seed++) {
    const s = startedMatch(n, seed);
    if (turnSeat(s) === want) return s;
  }
  throw new Error(`no seed yields starter seat ${want}`);
}

describe('STR/01 §6 — false accuser: always self-roulette, never accuser-executes', () => {
  it('6-round false-accusation ladder at 3p: SELF every round, kills stay 0, death only at the certain 6th pull', () => {
    // Seat 0 holds only truths (the accused); seat 1 = W (the serial false
    // accuser, bulletPos 6); seat 2 = filler. Starter chain (§2.3, TRUTH
    // verdict → next ccw after the previous starter, seats mod 3):
    const starterChain = [0, 1, 2, 0, 1, 2];
    const W = 1;
    let s = withBullets(seedWithStarter(3, 0), { 1: 6 });
    let t = T0 + 10;

    for (let round = 1; round <= 6; round++) {
      expect(turnSeat(s)).toBe(starterChain[round - 1]); // §2.3 chain, TRUTH side
      const table = s.round!.tableCard;
      s = withHands(s, { 0: [table, table, table, table, table] });

      // Build up the pile so seat 0's TRUTH is the LAST play before W calls:
      const starter = starterChain[round - 1];
      if (starter === 1) {
        // W starts: W plays (never judged), seat 2 plays, then seat 0's truth.
        s = ok(s, { type: 'PLAY', seat: 1, cardIds: handIds(s, 1).slice(0, 1), at: ++t }).s;
        s = ok(s, { type: 'PLAY', seat: 2, cardIds: handIds(s, 2).slice(0, 1), at: ++t }).s;
      } else if (starter === 2) {
        s = ok(s, { type: 'PLAY', seat: 2, cardIds: handIds(s, 2).slice(0, 1), at: ++t }).s;
      }
      s = ok(s, { type: 'PLAY', seat: 0, cardIds: handIds(s, 0).slice(0, 1), at: ++t }).s; // the truth
      expect(turnSeat(s)).toBe(W); // W holds the turn: the accusation is theirs

      const r = ok(s, { type: 'LIAR', seat: W, at: ++t });
      expect(findEffect(r.effects, 'REVEALED')).toMatchObject({
        accusedSeat: 0, challengerSeat: W, verdict: 'TRUTH', loserSeat: W,
      });
      const shot = findEffect(r.effects, 'SHOT_ASSIGNED')!;
      expect(shot).toMatchObject({ loserSeat: W, shotKind: 'SELF' }); // §6 row 2, always
      expect(shot.executorSeat).toBeUndefined(); // no accuser-EXECUTE path exists here

      const res = r.s.round!.resolution!;
      expect(res).toMatchObject({
        loserRole: 'accuser',
        pullNo: round,
        outcome: round < 6 ? 'BLANK' : 'LIVE', // bulletPos 6 ⇒ the 6th pull is certain death
        died: round === 6,
        dareDevil: round === 5, // surviving the 50/50 pull #5 is THE daredevil moment
      });
      expect(r.s.players[W].stats.falseAccusations).toBe(round);
      expect(r.s.players[W].stats.catches).toBe(0);
      expect(r.s.players[W].pulls).toBe(round);
      expect(r.s.players[W].stats.pullsSurvived).toBe(round < 6 ? round : 5); // one survived blank per round
      for (const seat of [0, 2]) {
        expect(r.s.players[seat].stats.kills).toBe(0); // nobody is ever executed
        expect(r.s.players[seat].pulls).toBe(0); // their own revolvers never fire
      }
      if (round < 6) expect(r.s.players[W].alive).toBe(true);

      let cur = ok(r.s, { type: 'REVEAL_ACK', at: ++t }).s;
      cur = ok(cur, { type: 'SHOT_ACK', at: ++t }).s;
      if (round < 6) {
        expect(cur.phase).toBe('ROUND_END'); // a blank still ends the round (§7)
        cur = ok(cur, { type: 'NEXT_ROUND', at: ++t }).s;
        s = ok(cur, { type: 'BEGIN_TURNS', at: ++t }).s;
      } else {
        // Death of ONE player at 3p does NOT end the match (§9): 2 remain.
        expect(cur.phase).toBe('ROUND_END');
        expect(cur.players[W].alive).toBe(false);
        expect(cur.players[W].stats.deaths).toBe(1);
        expect(cur.players[W].stats.deathCause).toBe('selfRoulette'); // never 'executed'
        s = cur;
      }
    }
  });

  it('§2.3 TRUTH-branch dead-designated fallback: a next-in-order accuser who dies hands the start to the seat PAST them', () => {
    let s = withBullets(seedWithStarter(3, 0), { 1: 1 }); // W's very first pull is fatal
    const W = 1;
    const table = s.round!.tableCard;
    s = withHands(s, { 0: [table, table, table, table, table] });
    s = ok(s, { type: 'PLAY', seat: 0, cardIds: handIds(s, 0).slice(0, 1), at: T0 + 5 }).s;
    expect(turnSeat(s)).toBe(W); // the accuser is exactly ccw(previous starter)
    s = ok(s, { type: 'LIAR', seat: W, at: T0 + 6 }).s;
    s = ok(s, { type: 'REVEAL_ACK', at: T0 + 7 }).s;
    s = ok(s, { type: 'SHOT_ACK', at: T0 + 8 }).s;
    expect(s.players[W].alive).toBe(false);
    expect(s.phase).toBe('ROUND_END');
    // designated = ccw(starter 0) = the dead accuser → fallback to ccw(dead) = 2:
    expect(s.pendingStarter).toBe(2);
    s = ok(s, { type: 'NEXT_ROUND', at: T0 + 9 }).s;
    s = ok(s, { type: 'BEGIN_TURNS', at: T0 + 10 }).s;
    expect(turnSeat(s)).toBe(2);
  });
});
