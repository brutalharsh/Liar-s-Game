import { describe, expect, it } from 'vitest';
import { apply, createMatch } from '../src/engine';
import type { Effect, GameState } from '../src/types';
import { ok, roster, startedMatch, T0, turnSeat, withBullets } from './helpers';

const handOf = (
  s: { players: { seat: number; hand: { id: string }[] }[] },
  seat: number,
): string[] => s.players.find((p) => p.seat === seat)!.hand.map((c) => c.id);

const first = <T extends Effect['kind']>(effs: Effect[], kind: T) =>
  effs.find((e) => e.kind === kind) as Extract<Effect, { kind: T }> | undefined;

const pileTopIds = (s: GameState): string[] => s.round!.pile.at(-1)!.cards.map((c) => c.id);

describe('A4 timeouts: auto-play, never auto-call', () => {
  it('timeout plays the PRE-STAGED selection when present', () => {
    let s = startedMatch(3, 301);
    const A = turnSeat(s);
    s = withBullets(s, { [0]: 6, [1]: 6, [2]: 6 });
    const staged = handOf(s, A).slice(0, 2);
    s = ok(s, { type: 'STAGE', seat: A, cardIds: staged, at: T0 + 4 }).s;
    const r = ok(s, { type: 'TURN_TIMEOUT', seat: A, at: s.turn!.deadline });
    const played = first(r.effects, 'PLAYED')!;
    expect(played.auto).toBe('timeout');
    expect(played.seat).toBe(A);
    expect(played.count).toBe(2);
    expect(pileTopIds(r.s)).toEqual(staged); // exactly the staged cards
    expect(r.s.players.find((p) => p.seat === A)!.hand).toHaveLength(3);
    expect(r.s.players.find((p) => p.seat === A)!.staged).toHaveLength(0);
  });

  it('timeout with NO staged selection plays exactly 1 random card via the port (deterministic)', () => {
    const run = (seed: number) => {
      const s = startedMatch(3, seed);
      const A = turnSeat(s);
      const r = apply(s, { type: 'TURN_TIMEOUT', seat: A, at: s.turn!.deadline });
      expect(r.err).toBeUndefined();
      const actor = r.state.players.find((p) => p.seat === A)!;
      expect(actor.hand).toHaveLength(4); // exactly one card left the hand
      return {
        state: r.state,
        ids: pileTopIds(r.state),
        playedCount: first(r.effects, 'PLAYED')!.count,
      };
    };
    const a = run(302);
    const b = run(302); // same seed → identical RngPort stream → identical choice
    expect(a.playedCount).toBe(1);
    expect(b.playedCount).toBe(1);
    expect(a.ids).toEqual(b.ids);
  });

  it('NEVER auto-calls: even the round-first player timing out auto-PLAYs (LIAR would be illegal anyway)', () => {
    const s = startedMatch(3, 303);
    const A = turnSeat(s);
    const r = ok(s, { type: 'TURN_TIMEOUT', seat: A, at: s.turn!.deadline });
    expect(r.s.phase).toBe('TURN');
    expect(first(r.effects, 'PLAYED')).toBeDefined();
    expect(r.effects.find((e) => e.kind === 'REVEALED')).toBeUndefined();
  });

  it('timeout with a challengeable pile still auto-plays (silence = belief)', () => {
    let s = startedMatch(3, 304);
    s = withBullets(s, { [0]: 6, [1]: 6, [2]: 6 });
    const A = turnSeat(s);
    const B = (A + 1) % 3;
    s = ok(s, { type: 'PLAY', seat: A, cardIds: handOf(s, A).slice(0, 1), at: T0 + 5 }).s;
    const r = ok(s, { type: 'TURN_TIMEOUT', seat: B, at: s.turn!.deadline });
    expect(first(r.effects, 'PLAYED')).toBeDefined();
    expect(r.effects.find((e) => e.kind === 'REVEALED')).toBeUndefined(); // no auto LIAR, ever
  });

  it('clock guards: before deadline → ERR_TOO_EARLY; wrong seat → ERR_NOT_YOUR_TURN; wrong phase → ERR_WRONG_PHASE', () => {
    const s = startedMatch(3, 305);
    const A = turnSeat(s);
    expect(apply(s, { type: 'TURN_TIMEOUT', seat: A, at: s.turn!.deadline - 1 }).err?.code).toBe(
      'ERR_TOO_EARLY',
    );
    expect(
      apply(s, { type: 'TURN_TIMEOUT', seat: (A + 1) % 3, at: s.turn!.deadline }).err?.code,
    ).toBe('ERR_NOT_YOUR_TURN');
    const dealt = ok(s, { type: 'PLAY', seat: A, cardIds: handOf(s, A).slice(0, 1), at: T0 + 5 });
    const liar = ok(dealt.s, { type: 'LIAR', seat: turnSeat(dealt.s), at: T0 + 6 });
    expect(apply(liar.s, { type: 'TURN_TIMEOUT', seat: 0, at: T0 + 100_000 }).err?.code).toBe(
      'ERR_WRONG_PHASE',
    );
  });

  it('fast-mode timeout inside the open window: auto-play closes the window (believed) and opens the next one', () => {
    let s = apply(createMatch({ roster: roster(7), seed: 306, config: { fastMode: true } }), {
      type: 'MATCH_START',
      at: T0,
    }).state;
    s = apply(s, { type: 'BEGIN_TURNS', at: T0 + 1 }).state;
    s = withBullets(s, { [0]: 6, [1]: 6, [2]: 6, [3]: 6, [4]: 6, [5]: 6, [6]: 6 });
    const A = turnSeat(s);
    s = ok(s, { type: 'PLAY', seat: A, cardIds: handOf(s, A).slice(0, 1), at: T0 + 5 }).s;
    expect(s.phase).toBe('WINDOW');
    // Fast table: 10s turn — B's deadline == the window's closesAt:
    const B = turnSeat(s);
    expect(s.turn!.deadline).toBe(T0 + 5 + 10_000);
    const r = ok(s, { type: 'TURN_TIMEOUT', seat: B, at: s.turn!.deadline });
    expect(first(r.effects, 'PLAYED')?.auto).toBe('timeout');
    expect(first(r.effects, 'WINDOW_CLOSED')).toMatchObject({ reason: 'believed', accusedSeat: A });
    expect(first(r.effects, 'WINDOW_OPENED')?.accusedSeat).toBe(B); // fresh window on B's auto-play
    expect(r.s.phase).toBe('WINDOW');
  });
});

describe('A4 disconnect policy: 60s grace, "drunk under the table", no elimination', () => {
  it('a timeout during grace is refused (ERR_GRACE); ABANDON before grace → ERR_TOO_EARLY', () => {
    let s = startedMatch(3, 311);
    const A = turnSeat(s);
    s = ok(s, { type: 'DISCONNECT', seat: A, at: T0 + 5 }).s;
    const refused = apply(s, { type: 'TURN_TIMEOUT', seat: A, at: s.turn!.deadline }); // deadline < dc+60s
    expect(refused.err?.code).toBe('ERR_GRACE');
    expect(refused.state.phase).toBe('TURN'); // the match simply waits
    expect(apply(s, { type: 'ABANDON', seat: A, at: T0 + 60_000 }).err?.code).toBe('ERR_TOO_EARLY');
  });

  it('after 60s of grace the seat auto-plays (tagged disconnect), drunk — never eliminated', () => {
    let s = startedMatch(3, 312);
    const A = turnSeat(s);
    s = ok(s, { type: 'DISCONNECT', seat: A, at: T0 + 5 }).s;
    const at = Math.max(s.turn!.deadline, T0 + 5 + 60_000) + 1; // past both the deadline and grace
    const r = ok(s, { type: 'TURN_TIMEOUT', seat: A, at });
    const played = first(r.effects, 'PLAYED')!;
    expect(played.auto).toBe('disconnect');
    expect(r.s.players.find((p) => p.seat === A)!.alive).toBe(true); // drunk under the table, not dead
    expect(r.s.phase).toBe('TURN');
  });

  it('ABANDON after grace marks the seat lost; reconnect restores watching, not acting', () => {
    let s = startedMatch(3, 313);
    const A = turnSeat(s);
    s = ok(s, { type: 'DISCONNECT', seat: A, at: T0 + 5 }).s;
    s = ok(s, { type: 'ABANDON', seat: A, at: T0 + 65_000 }).s;
    expect(s.players.find((p) => p.seat === A)!.abandoned).toBe(true);
    // The auto-player covers their turns:
    const r = ok(s, { type: 'TURN_TIMEOUT', seat: A, at: T0 + 100_000 });
    expect(first(r.effects, 'PLAYED')?.auto).toBe('disconnect');
    expect(r.s.phase).toBe('TURN');
    // They reconnect as a spectator: presence updates, acting stays denied:
    const back = ok(r.s, { type: 'RECONNECT', seat: A, at: T0 + 110_000 });
    expect(back.effects.find((e) => e.kind === 'PRESENCE')).toBeDefined();
    const denied = apply(back.s, { type: 'PLAY', seat: A, cardIds: [], at: T0 + 111_000 });
    expect(denied.err?.code).toBe('ERR_ABANDONED');
  });

  it('DISCONNECT then RECONNECT inside grace: the player acts again, no punishment', () => {
    let s = startedMatch(3, 314);
    const A = turnSeat(s);
    s = ok(s, { type: 'DISCONNECT', seat: A, at: T0 + 5 }).s;
    const denied = apply(s, {
      type: 'PLAY',
      seat: A,
      cardIds: handOf(s, A).slice(0, 1),
      at: T0 + 6,
    });
    expect(denied.err?.code).toBe('ERR_DISCONNECTED'); // an offline seat cannot act
    s = ok(s, { type: 'RECONNECT', seat: A, at: T0 + 20_000 }).s;
    const played = ok(s, {
      type: 'PLAY',
      seat: A,
      cardIds: handOf(s, A).slice(0, 1),
      at: T0 + 21_000,
    });
    expect(played.effects.find((e) => e.kind === 'PLAYED')).toBeDefined();
  });

  it('a disconnected NON-turn player blocks nothing; grace applies only to their own turns', () => {
    let s = startedMatch(3, 315);
    const A = turnSeat(s);
    const C = (A + 2) % 3;
    s = ok(s, { type: 'DISCONNECT', seat: C, at: T0 + 5 }).s;
    const r = ok(s, { type: 'PLAY', seat: A, cardIds: handOf(s, A).slice(0, 1), at: T0 + 6 });
    expect(r.effects.find((e) => e.kind === 'PLAYED')).toBeDefined();
  });

  it('ABANDON without a preceding DISCONNECT → ERR_NOT_DISCONNECTED', () => {
    const s = startedMatch(3, 316);
    expect(apply(s, { type: 'ABANDON', seat: 1, at: T0 + 5 }).err?.code).toBe(
      'ERR_NOT_DISCONNECTED',
    );
  });
});
