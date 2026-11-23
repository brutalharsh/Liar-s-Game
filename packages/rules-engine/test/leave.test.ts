import { describe, expect, it } from 'vitest';
import type { Effect } from '../src/types';
import { ok, startedMatch, T0, turnSeat, withBullets, withHands } from './helpers';

const handOf = (s: { players: { seat: number; hand: { id: string }[] }[] }, seat: number): string[] =>
  s.players.find((p) => p.seat === seat)!.hand.map((c) => c.id);

const gameOver = (effs: Effect[]) =>
  effs.find((e) => e.kind === 'GAME_OVER') as Extract<Effect, { kind: 'GAME_OVER' }> | undefined;

describe('Win & abort semantics (STR/01 §9 / R32)', () => {
  it('last player alive wins the normal way (roulette deaths, no abort)', () => {
    let s = startedMatch(2, 401);
    const A = turnSeat(s);
    const B = (A + 1) % 2;
    s = withBullets(s, { [A]: 1, [B]: 6 });
    const off = (s.round!.tableCard === 'K' ? 'Q' : 'K') as 'Q' | 'K';
    s = withHands(s, { [A]: [off, off, off, off, off] }); // A bluffs
    s = ok(s, { type: 'PLAY', seat: A, cardIds: handOf(s, A).slice(0, 1), at: T0 + 5 }).s;
    const r = ok(s, { type: 'LIAR', seat: B, at: T0 + 6 }); // B catches → A pulls (bullet 1) → dies
    s = ok(r.s, { type: 'REVEAL_ACK', at: T0 + 7 }).s;
    const end = ok(s, { type: 'SHOT_ACK', at: T0 + 8 });
    expect(end.s.phase).toBe('GAME_END');
    expect(end.s.winnerSeat).toBe(B);
    expect(end.s.aborted).toBe(false);
    const over = gameOver(end.effects)!;
    expect(over.record.winnerSeat).toBe(B);
    expect(over.record.aborted).toBe(false);
    expect(end.s.players.find((p) => p.seat === B)!.stats.won).toBe(true);
    expect(end.s.players.find((p) => p.seat === B)!.stats.xpEarned).toBe(12); // win 12 XP (STR/04 §5)
    expect(end.s.players.find((p) => p.seat === A)!.stats.xpEarned).toBe(4); // died → 4 XP
  });

  it('2p: one player LEAVES mid-round → the remaining player wins by default (abort)', () => {
    let s = startedMatch(2, 402);
    const A = turnSeat(s);
    const B = (A + 1) % 2;
    s = ok(s, { type: 'PLAY', seat: A, cardIds: handOf(s, A).slice(0, 2), at: T0 + 5 }).s;
    s = withBullets(s, { [B]: 1 });
    const r = ok(s, { type: 'LEAVE', seat: A, at: T0 + 6 });
    const over = gameOver(r.effects)!;
    expect(r.s.phase).toBe('GAME_END');
    expect(over.winnerSeat).toBe(B);
    expect(over.aborted).toBe(true);
    expect(r.s.winnerSeat).toBe(B);
    // The leaver gets no completion XP and no win; the survivor wins:
    const leaver = r.s.players.find((p) => p.seat === A)!;
    const survivor = r.s.players.find((p) => p.seat === B)!;
    expect(leaver.stats.won).toBe(false);
    expect(leaver.stats.xpEarned).toBe(0);
    expect(survivor.stats.won).toBe(true);
    expect(survivor.stats.xpEarned).toBe(12);
    // Survivor coins = survived rounds (0 completed) + randInt(2..7) win roll:
    expect(survivor.stats.coinsEarned).toBeGreaterThanOrEqual(2);
    expect(survivor.stats.coinsEarned).toBeLessThanOrEqual(7);
    expect(leaver.stats.coinsEarned).toBe(0);
  });

  it('2p: grace expiry (ABANDON) also aborts with win-by-default', () => {
    let s = startedMatch(2, 403);
    const A = turnSeat(s);
    const B = (A + 1) % 2;
    s = ok(s, { type: 'DISCONNECT', seat: A, at: T0 + 5 }).s;
    const r = ok(s, { type: 'ABANDON', seat: A, at: T0 + 70_000 });
    const over = gameOver(r.effects)!;
    expect(over.aborted).toBe(true);
    expect(over.winnerSeat).toBe(B);
  });

  it('if EVERYONE leaves: no winner, aborted record (STR/01 §9 "match aborted")', () => {
    // Deferred-abort path: both living players leave WHILE a reveal is in
    // flight; the pending blank resolution then completes with zero present
    // players left → match aborted with NO winner by default.
    let s = startedMatch(2, 404);
    const A = turnSeat(s);
    const B = (A + 1) % 2;
    s = withBullets(s, { [A]: 6, [B]: 6 }); // the shot will be a blank
    const table = s.round!.tableCard;
    s = withHands(s, { [A]: [table, table, table, table, table] });
    s = ok(s, { type: 'PLAY', seat: A, cardIds: s.players[A].hand.map((c) => c.id).slice(0, 1), at: T0 + 5 }).s;
    const r = ok(s, { type: 'LIAR', seat: B, at: T0 + 6 }); // REVEAL in flight (verdict TRUTH)
    // A and B both walk mid-reveal; the challenge resolution must still complete:
    s = ok(r.s, { type: 'LEAVE', seat: A, at: T0 + 6_100 }).s;
    expect(s.phase).toBe('REVEAL'); // abort deferred while resolution is in flight
    s = ok(s, { type: 'LEAVE', seat: B, at: T0 + 6_200 }).s;
    s = ok(s, { type: 'REVEAL_ACK', at: T0 + 6_300 }).s;
    const end = ok(s, { type: 'SHOT_ACK', at: T0 + 6_400 });
    expect(end.s.phase).toBe('GAME_END');
    expect(end.s.winnerSeat).toBeNull();
    expect(end.s.matchRecord!.winnerSeat).toBeNull();
    expect(end.s.matchRecord!.aborted).toBe(true);
    for (const p of end.s.players) {
      expect(p.stats.won).toBe(false);
      expect(p.stats.xpEarned).toBe(0);
    }
    // The blank DID resolve (one roulette, round completed):
    expect(end.s.matchRecord!.summary.totalPulls).toBe(1);
  });

  it('3p: one leave does NOT abort (2 present players remain); two leaves abort to the survivor', () => {
    let s = startedMatch(3, 405);
    s = ok(s, { type: 'LEAVE', seat: 0, at: T0 + 5 }).s;
    expect(s.phase).toBe('TURN'); // game continues, seat 0 becomes an auto-player
    expect(s.players.find((p) => p.seat === 0)!.abandoned).toBe(true);
    const r = ok(s, { type: 'LEAVE', seat: 1, at: T0 + 6 });
    expect(r.s.phase).toBe('GAME_END');
    expect(r.s.winnerSeat).toBe(2);
    expect(r.s.matchRecord!.aborted).toBe(true);
  });

  it('the abandoned auto-player can EARLIER be shot at normally (alive-but-absent targets are legal)', () => {
    let s = startedMatch(3, 406);
    const A = turnSeat(s);
    const B = (A + 1) % 3;
    s = withBullets(s, { [A]: 1, [B]: 6, [(A + 2) % 3]: 6 });
    s = ok(s, { type: 'LEAVE', seat: (A + 2) % 3, at: T0 + 4 }).s;
    const off = (s.round!.tableCard === 'K' ? 'Q' : 'K') as 'Q' | 'K';
    s = withHands(s, { [A]: [off, off, off, off, off] }); // the newly-absent abando seat's bluff gets caught: use A as liar, B as the catcher
    s = ok(s, { type: 'PLAY', seat: A, cardIds: handOf(s, A).slice(0, 1), at: T0 + 5 }).s;
    const r = ok(s, { type: 'LIAR', seat: B, at: T0 + 6 });
    s = ok(r.s, { type: 'REVEAL_ACK', at: T0 + 7 }).s;
    s = ok(s, { type: 'SHOT_ACK', at: T0 + 8 }).s;
    expect(s.players.find((p) => p.seat === A)!.alive).toBe(false); // A died on the first pull
    // Present alive = { B } → abort fires on the NEXT event (.SHOT_ACK already ended it):
    expect(s.phase).toBe('GAME_END');
    expect(s.winnerSeat).toBe(B);
  });

  it('abort defers politely while REVEAL/SHOT are in flight (the pending resolution completes)', () => {
    let s = startedMatch(3, 407);
    const A = turnSeat(s);
    const B = (A + 1) % 3;
    s = withBullets(s, { [A]: 1, [B]: 6, [(A + 2) % 3]: 6 });
    const off = (s.round!.tableCard === 'K' ? 'Q' : 'K') as 'Q' | 'K';
    s = withHands(s, { [A]: [off, off, off, off, off] });
    s = ok(s, { type: 'PLAY', seat: A, cardIds: handOf(s, A).slice(0, 1), at: T0 + 5 }).s;
    const r = ok(s, { type: 'LIAR', seat: B, at: T0 + 6 }); // REVEAL in flight, A will die
    // A leaves DURING the reveal — the shot resolution must still complete:
    const left = ok(r.s, { type: 'LEAVE', seat: (A + 2) % 3, at: T0 + 6_100 });
    expect(left.s.phase).toBe('REVEAL'); // not aborted mid-reveal
    const shown = ok(left.s, { type: 'REVEAL_ACK', at: T0 + 6_200 });
    const end = ok(shown.s, { type: 'SHOT_ACK', at: T0 + 6_300 });
    expect(end.s.phase).toBe('GAME_END');
    expect(end.s.matchRecord!.summary.totalPulls).toBe(1); // the roulette DID resolve
    expect(end.s.matchRecord!.aborted).toBe(true);
    expect(end.s.winnerSeat).toBe(B); // last present alive wins by default
  });
});
