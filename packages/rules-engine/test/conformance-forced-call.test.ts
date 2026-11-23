/**
 * STR/01 §8 conformance — hand exhaustion & the forced call (R29/R30).
 *
 * liar.test pins the trigger (holders == 1 fires instantly, next player
 * never gets a turn) and both verdict endings. NOT yet pinned, pinned here:
 *   - the FORCED challenger is stats-credited exactly like a voluntary
 *     caller (README interp. #3: `catches` on a caught lie — uniform
 *     semantics for §10 `catches`/`falseAccusations`);
 *   - the negatives of "the instant only ONE player still holds cards":
 *     an empty hand alone (with 2+ holders remaining) must NOT resolve the
 *     round — the auto-call fires ONLY when no legal play remains for
 *     anyone else, and in particular NOT while both players still hold.
 */
import { describe, expect, it } from 'vitest';
import type { Effect } from '../src/types';
import { handIds, ok, startedMatch, T0, turnSeat, withBullets, withHands } from './helpers';

function findEffect<T extends Effect['kind']>(effects: Effect[], kind: T) {
  return effects.find((e) => e.kind === kind) as Extract<Effect, { kind: T }> | undefined;
}

describe('STR/01 §8 — forced call credit & the only-at-exhaustion guard', () => {
  it('2p: forced call on a LYING finisher credits catches to the forced challenger', () => {
    let s = withBullets(startedMatch(2, 9500), { 0: 6, 1: 6 });
    const A = turnSeat(s);
    const B = (A + 1) % 2;
    const table = s.round!.tableCard;
    const off = table === 'K' ? 'Q' : 'K';
    s = withHands(s, { [A]: [table, table, table, off, off] });
    s = ok(s, { type: 'PLAY', seat: A, cardIds: handIds(s, A).slice(0, 3), at: T0 + 5 }).s; // truths
    s = ok(s, { type: 'PLAY', seat: B, cardIds: handIds(s, B).slice(0, 3), at: T0 + 6 }).s; // filler
    const r = ok(s, { type: 'PLAY', seat: A, cardIds: handIds(s, A), at: T0 + 7 }); // empties with the lie

    expect(r.s.phase).toBe('REVEAL'); // forced auto-call: no B decision ever existed
    expect(findEffect(r.effects, 'REVEALED')).toMatchObject({
      forced: true,
      challengerSeat: B,
      accusedSeat: A,
      verdict: 'LIE',
      loserSeat: A,
    });
    expect(r.s.round!.resolution!.pullNo).toBe(1);
    expect(r.s.players[B].stats.catches).toBe(1); // §10 catch, credited even when forced
    expect(r.s.players[B].stats.falseAccusations).toBe(0);
    expect(r.s.players[B].pulls).toBe(0); // B's revolver never fires — A lost
    expect(r.s.players[A].stats.bluffSuccesses).toBe(0); // caught lies are not bluffs
    expect(r.s.players[A].pulls).toBe(1); // the loser's own gun takes the pull
  });

  it('the auto-call fires ONLY at holders == 1: 2p/3p exhaustion-in-progress stays in TURN', () => {
    // 2p: both still hold cards after one play each — nothing may resolve.
    let s = startedMatch(2, 9501);
    const A = turnSeat(s);
    const B = (A + 1) % 2;
    const r1 = ok(s, { type: 'PLAY', seat: A, cardIds: handIds(s, A).slice(0, 3), at: T0 + 5 });
    expect(r1.s.phase).toBe('TURN'); // A: 2, B: 5 → two holders
    expect(r1.s.round!.resolution).toBeUndefined();
    const r2 = ok(r1.s, {
      type: 'PLAY',
      seat: B,
      cardIds: handIds(r1.s, B).slice(0, 3),
      at: T0 + 6,
    });
    expect(r2.s.phase).toBe('TURN'); // A: 2, B: 2 → still two holders
    expect(r2.s.round!.resolution).toBeUndefined();
    expect(r2.effects.some((e) => e.kind === 'REVEALED')).toBe(false);

    // 3p: a seat empties entirely, but TWO holders remain → the round continues.
    let s3 = startedMatch(3, 9502);
    const X = turnSeat(s3);
    s3 = ok(s3, { type: 'PLAY', seat: X, cardIds: handIds(s3, X).slice(0, 3), at: T0 + 5 }).s; // X: 3 played
    s3 = ok(s3, {
      type: 'PLAY',
      seat: turnSeat(s3),
      cardIds: handIds(s3, turnSeat(s3)).slice(0, 1),
      at: T0 + 6,
    }).s; // Y
    s3 = ok(s3, {
      type: 'PLAY',
      seat: turnSeat(s3),
      cardIds: handIds(s3, turnSeat(s3)).slice(0, 1),
      at: T0 + 7,
    }).s; // Z
    expect(turnSeat(s3)).toBe(X); // the rotation is back at X (still holding 2)
    const rEmpty = ok(s3, { type: 'PLAY', seat: X, cardIds: handIds(s3, X), at: T0 + 8 }); // X empties
    expect(rEmpty.s.players.find((p) => p.seat === X)!.hand).toHaveLength(0);
    expect(rEmpty.s.phase).toBe('TURN'); // NOT REVEAL: an empty hand alone resolves nothing
    expect(rEmpty.s.round!.resolution).toBeUndefined();
    const nextHolder = rEmpty.s.turn!.seat;
    expect(nextHolder).not.toBe(X); // the empty seat is passed over (§2.4/§8 "skipped")
    expect(rEmpty.s.players.find((p) => p.seat === nextHolder)!.hand.length).toBeGreaterThan(0);
    const rPlayOn = ok(rEmpty.s, {
      type: 'PLAY',
      seat: nextHolder,
      cardIds: handIds(rEmpty.s, nextHolder).slice(0, 1),
      at: T0 + 9,
    });
    expect(rPlayOn.s.phase).toBe('TURN'); // the round simply continues
    expect(rPlayOn.s.round!.resolution).toBeUndefined();
  });
});
