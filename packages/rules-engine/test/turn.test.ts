import { describe, expect, it } from 'vitest';
import { apply } from '../src/engine';
import { DEFAULT_MATCH_CONFIG, challengeModeFor, turnTimerMs } from '../src/types';
import type { Effect, GameState } from '../src/types';
import { ok, startedMatch, T0, turnSeat, withBullets, withHands } from './helpers';

describe('Turn timers (A4 ladder)', () => {
  it.each([
    [2, 30_000],
    [3, 30_000],
    [4, 20_000],
    [5, 20_000],
    [6, 15_000],
    [10, 15_000],
  ])('%sp → %sms (alive count derived)', (n, ms) => {
    expect(turnTimerMs(DEFAULT_MATCH_CONFIG, n)).toBe(ms);
  });

  it('host fast toggle → 10s at every alive count; override wins over everything', () => {
    const fast = { ...DEFAULT_MATCH_CONFIG, fastMode: true };
    expect(turnTimerMs(fast, 2)).toBe(10_000);
    expect(turnTimerMs(fast, 10)).toBe(10_000);
    expect(turnTimerMs({ ...fast, turnTimerMsOverride: 7_777 }, 7)).toBe(7_777);
  });

  it('challenge mode: next-only ≤4 alive, open window ≥5 (A2 boundary)', () => {
    expect(challengeModeFor(DEFAULT_MATCH_CONFIG, 2)).toBe('next-only');
    expect(challengeModeFor(DEFAULT_MATCH_CONFIG, 4)).toBe('next-only');
    expect(challengeModeFor(DEFAULT_MATCH_CONFIG, 5)).toBe('open-window');
    expect(challengeModeFor(DEFAULT_MATCH_CONFIG, 10)).toBe('open-window');
    expect(challengeModeFor({ ...DEFAULT_MATCH_CONFIG, windowMode: 'next-only' }, 10)).toBe('next-only');
  });
});

describe('validatePlay clauses (doc-14 task 17 — negative per clause)', () => {
  it('rejects 0 cards, 4 cards, duplicates, foreign cards, off-turn plays', () => {
    const s = startedMatch(3);
    const A = turnSeat(s);
    const ids = s.players[A].hand.map((c) => c.id);
    const table: [string, number, string[], string][] = [
      ['0 cards is not a play', A, [], 'ERR_INVALID_COUNT'],
      ['4 cards exceeds 1..3', A, ids.slice(0, 4), 'ERR_INVALID_COUNT'],
      ['duplicate card ids', A, [ids[0], ids[0]], 'ERR_DUPLICATE_CARD'],
      ['foreign card id (garbage)', A, ['nope'], 'ERR_NOT_OWNED_CARD'],
      ["another player's card", A, s.players[(A + 1) % 3].hand.map((c) => c.id).slice(0, 1), 'ERR_NOT_OWNED_CARD'],
      ['not the turn-holder', (A + 1) % 3, ids.slice(0, 1), 'ERR_NOT_YOUR_TURN'],
    ];
    for (const [name, seat, cardIds, code] of table) {
      const r = apply(s, { type: 'PLAY', seat, cardIds, at: T0 + 5 });
      expect(r.err?.code, name).toBe(code);
    }
  });

  it('a valid play removes exactly those cards and broadcasts counts only', () => {
    const s = startedMatch(3);
    const A = turnSeat(s);
    const ids = s.players[A].hand.map((c) => c.id).slice(0, 2);
    const r = ok(s, { type: 'PLAY', seat: A, cardIds: ids, at: T0 + 5 });
    expect(r.s.players[A].hand.map((c) => c.id)).not.toContain(ids[0]);
    expect(r.s.players[A].hand).toHaveLength(3);
    const played = r.effects.find((e) => e.kind === 'PLAYED') as Extract<Effect, { kind: 'PLAYED' }>;
    expect(played.seat).toBe(A);
    expect(played.count).toBe(2);
    expect(played.pile).toEqual([{ seat: A, count: 2 }]);
    expect(JSON.stringify(played)).not.toContain('rank'); // face-down count only
  });
});

describe('Counter-clockwise turn order skips dead + empty-handed (R27/R28)', () => {
  it('skips an empty-handed player and wraps around', () => {
    let s = startedMatch(3); // seats 0..2, starter = turnSeat
    const A = turnSeat(s);
    const B = (A + 1) % 3;
    const C = (A + 2) % 3;
    s = ok(s, { type: 'PLAY', seat: A, cardIds: handOf(s, A).slice(0, 1), at: T0 + 5 }).s;
    expect(turnSeat(s)).toBe(B);
    // Empty B's hand to 1 card, then play it out:
    s = withHands(s, { [B]: ['K'] });
    s = ok(s, { type: 'PLAY', seat: B, cardIds: handOf(s, B), at: T0 + 6 }).s;
    expect(s.players[B].hand).toHaveLength(0);
    // B is now empty → the next holder is C:
    expect(turnSeat(s)).toBe(C);
    s = ok(s, { type: 'PLAY', seat: C, cardIds: handOf(s, C).slice(0, 1), at: T0 + 7 }).s;
    // wraps to A (alive + holding), skipping empty B:
    expect(turnSeat(s)).toBe(A);
    // empty player cannot challenge in next-only mode (no turn = no challenge right)
    const r = apply(s, { type: 'LIAR', seat: B, at: T0 + 8 });
    expect(r.err?.code).toBe('ERR_NOT_YOUR_TURN');
  });

  it('dead skip (bullet controlled): rotation jumps the dead seat across rounds', () => {
    let s = startedMatch(4);
    const A = turnSeat(s);
    const B = (A + 1) % 4;
    const table = s.round!.tableCard;
    const off = table === 'K' ? 'Q' : 'K';
    s = withBullets(s, { [A]: 1 }); // A dies when caught
    s = withHands(s, {
      [A]: [off, off, off, off, off],
      [B]: [table, table, table, table, table],
    });
    s = ok(s, { type: 'PLAY', seat: A, cardIds: handOf(s, A).slice(0, 2), at: T0 + 5 }).s;
    const r = ok(s, { type: 'LIAR', seat: B, at: T0 + 6 });
    expect(r.effects.find((e) => e.kind === 'REVEALED')).toMatchObject({ verdict: 'LIE', loserSeat: A });
    const afterShot = ok(r.s, { type: 'REVEAL_ACK', at: T0 + 7 });
    s = ok(afterShot.s, { type: 'SHOT_ACK', at: T0 + 8 }).s;
    expect(s.players[A].alive).toBe(false);
    // Starter next round = caught liar A, dead → next living ccw = B:
    s = ok(s, { type: 'NEXT_ROUND', at: T0 + 9 }).s;
    s = ok(s, { type: 'BEGIN_TURNS', at: T0 + 10 }).s;
    expect(turnSeat(s)).toBe((A + 1) % 4);
    // Dead seats are not dealt into the new round; alive seats hold exactly 5:
    expect(s.players[A].hand).toHaveLength(0);
    for (const p of s.players) if (p.alive) expect(p.hand).toHaveLength(5);
  });
});

describe('STAGE (pre-staging selection, A4 source)', () => {
  it('accepts 0..3 of your own cards; clears with empty selection', () => {
    let s = startedMatch(3);
    const A = turnSeat(s);
    const ids = handOf(s, A);
    s = ok(s, { type: 'STAGE', seat: (A + 1) % 3, cardIds: handOf(s, (A + 1) % 3).slice(0, 2), at: T0 + 3 }).s;
    expect(s.players[(A + 1) % 3].staged).toHaveLength(2);
    s = ok(s, { type: 'STAGE', seat: (A + 1) % 3, cardIds: [], at: T0 + 4 }).s;
    expect(s.players[(A + 1) % 3].staged).toHaveLength(0);
    for (const bad of [['x'], handOf(s, (A + 2) % 3).slice(0, 2), [...ids.slice(0, 1), ...ids.slice(0, 1)]] as string[][]) {
      const r = apply(s, { type: 'STAGE', seat: (A + 2) % 3, cardIds: bad, at: T0 + 5 });
      expect(r.err?.code).toMatch(/ERR_(NOT_OWNED_CARD|DUPLICATE_CARD)/);
    }
  });

  it('staged selection is cleared on play and on redeal', () => {
    let s = startedMatch(3);
    const A = turnSeat(s);
    s = ok(s, { type: 'STAGE', seat: A, cardIds: handOf(s, A).slice(0, 2), at: T0 + 3 }).s;
    expect(s.players[A].staged).toHaveLength(2);
    s = ok(s, { type: 'PLAY', seat: A, cardIds: handOf(s, A).slice(0, 1), at: T0 + 5 }).s;
    expect(s.players[A].staged).toHaveLength(0);

    // Race everyone empty in sequence to reach the forced call (R29):
    // A has 4 left after his play; B and C still hold 5.
    // Stage someone mid-round to prove redeal clears staged cards.
    const B = turnSeat(s);
    s = ok(s, { type: 'STAGE', seat: B, cardIds: handOf(s, B).slice(0, 1), at: T0 + 6 }).s;
    expect(s.players[B].staged).toHaveLength(1);

    // A plays 4 more (2 plays), B and C dump theirs, until one holder remains.
    let t = T0 + 10;
    let guard = 0;
    while (s.phase === 'TURN' && guard++ < 30) {
      const seat = turnSeat(s);
      const ids = handOf(s, seat).slice(0, 3);
      s = ok(s, { type: 'PLAY', seat, cardIds: ids, at: t }).s;
      t += 1;
    }
    expect(s.phase).toBe('REVEAL'); // forced call fired the instant holders == 1
    s = ok(s, { type: 'REVEAL_ACK', at: t }).s;
    s = ok(s, { type: 'SHOT_ACK', at: t + 1 }).s;
    if (s.phase === 'ROUND_END') {
      s = ok(s, { type: 'NEXT_ROUND', at: t + 2 }).s;
      for (const p of s.players) {
        if (p.alive) {
          expect(p.staged).toHaveLength(0); // redeal clears staged selections
          expect(p.hand).toHaveLength(5);
        }
      }
    }
  });
});

function handOf(s: GameState, seat: number): string[] {
  return s.players.find((p) => p.seat === seat)!.hand.map((c) => c.id);
}
