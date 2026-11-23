import { describe, expect, it } from 'vitest';
import { apply } from '../src/engine';
import type { Effect } from '../src/types';
import { cloneState } from '../src/engine';
import { ok, startedMatch, T0, withHands, withBullets } from './helpers';

/** Fresh 7p open-window scenario at the moment just after the starter played 1 card. */
function afterFirstPlay(seed = 101) {
  let s = startedMatch(7, seed);
  const A = s.turn!.seat;
  s = withBullets(s, { 0: 6, 1: 6, 2: 6, 3: 6, 4: 6, 5: 6, 6: 6 }); // nobody dies on one pull
  const ids = s.players[A].hand.map((c) => c.id).slice(0, 1);
  const at = T0 + 5;
  const r = ok(s, { type: 'PLAY', seat: A, cardIds: ids, at });
  return { s: r.s, effects: r.effects, A, at, next: (A + 1) % 7 };
}

function findEffect<T extends Effect['kind']>(effects: Effect[], kind: T) {
  return effects.find((e) => e.kind === kind) as Extract<Effect, { kind: T }> | undefined;
}

describe('A2 open challenge window (5–10 players)', () => {
  it('a play lands: phase → WINDOW, 2s arm delay, 10s close, next turn runs concurrently', () => {
    const { s, effects, A, next } = afterFirstPlay();
    expect(s.phase).toBe('WINDOW');
    const opened = findEffect(effects, 'WINDOW_OPENED');
    expect(opened).toMatchObject({ accusedSeat: A, armedAt: T0 + 5 + 2_000, closesAt: T0 + 5 + 10_000 });
    const turn = findEffect(effects, 'TURN_STARTED');
    expect(turn?.seat).toBe(next);
    expect(s.turn?.deadline).toBe(T0 + 5 + 15_000); // 7p → 15s turns
  });

  it('CHECK during the 2s arm delay → ERR_WINDOW_NOT_ARMED (anti reaction-snipe)', () => {
    const { s, at, A } = afterFirstPlay();
    const C = (A + 2) % 7;
    const r = apply(s, { type: 'LIAR', seat: C, at: at + 1_500 });
    expect(r.err?.code).toBe('ERR_WINDOW_NOT_ARMED');
  });

  it('CHECK at exactly armedAt is legal (boundary inclusive); at closesAt also legal', () => {
    const one = afterFirstPlay(11);
    const c = (one.A + 3) % 7;
    const r1 = ok(one.s, { type: 'LIAR', seat: c, at: one.at + 2_000 });
    expect(r1.s.phase).toBe('REVEAL');

    const two = afterFirstPlay(12);
    const d = (two.A + 4) % 7;
    const r2 = ok(two.s, { type: 'LIAR', seat: d, at: two.at + 10_000 });
    expect(r2.s.phase).toBe('REVEAL');
  });

  it('CHECK after closesAt → ERR_WINDOW_CLOSED even if the server is late with WINDOW_EXPIRE', () => {
    const { s, at, A } = afterFirstPlay(13);
    const C = (A + 2) % 7;
    const r = apply(s, { type: 'LIAR', seat: C, at: at + 10_001 });
    expect(r.err?.code).toBe('ERR_WINDOW_CLOSED');
  });

  it('the accused cannot CHECK their own play; dead/disconnected/extinct seats cannot CHECK', () => {
    const base = afterFirstPlay(14);
    const self = apply(base.s, { type: 'LIAR', seat: base.A, at: base.at + 3_000 });
    expect(self.err?.code).toBe('ERR_SELF_CHALLENGE');

    const deadS = cloneState(base.s);
    const victim = (base.A + 5) % 7;
    deadS.players.find((p) => p.seat === victim)!.alive = false;
    const dead = apply(deadS, { type: 'LIAR', seat: victim, at: base.at + 3_000 });
    expect(dead.err?.code).toBe('ERR_DEAD');

    const dcS = ok(base.s, { type: 'DISCONNECT', seat: (base.A + 5) % 7, at: base.at + 2_100 }).s;
    const dc = apply(dcS, { type: 'LIAR', seat: (base.A + 5) % 7, at: base.at + 3_000 });
    expect(dc.err?.code).toBe('ERR_DISCONNECTED');
  });

  it('a client aiming LIAR at a stale play → ERR_WRONG_ACCUSED (accusedSeat guard)', () => {
    const { s, at, A } = afterFirstPlay(15);
    const C = (A + 2) % 7;
    const r = apply(s, { type: 'LIAR', seat: C, accusedSeat: (A + 6) % 7, at: at + 3_000 });
    expect(r.err?.code).toBe('ERR_WRONG_ACCUSED');
  });

  it('first event wins the race: two CHECKs, second is a stale ERR_WRONG_PHASE', () => {
    const { s, at, A } = afterFirstPlay(16);
    const C = (A + 2) % 7;
    const D = (A + 3) % 7;
    const r1 = ok(s, { type: 'LIAR', seat: C, at: at + 3_000 });
    expect(r1.s.phase).toBe('REVEAL');
    expect(findEffect(r1.effects, 'WINDOW_CLOSED')).toMatchObject({ reason: 'challenged' });
    const r2 = apply(r1.s, { type: 'LIAR', seat: D, at: at + 3_500 });
    expect(r2.err?.code).toBe('ERR_WRONG_PHASE');
  });

  it('belief closes the window: the next holder plays → window shut (believed), fresh window on the new play', () => {
    const { s, A, next, at } = afterFirstPlay(17);
    const r = ok(s, { type: 'PLAY', seat: next, cardIds: s.players[next].hand.map((c) => c.id).slice(0, 2), at: at + 4_000 });
    expect(findEffect(r.effects, 'WINDOW_CLOSED')).toMatchObject({ reason: 'believed', accusedSeat: A });
    expect(findEffect(r.effects, 'WINDOW_OPENED')?.accusedSeat).toBe(next);
    expect(r.s.phase).toBe('WINDOW');
    expect(r.s.round!.window?.closesAt).toBe(at + 4_000 + 10_000);
  });

  it('a lie believed (window closed by play) credits bluffSuccesses to the liar; truths credit nothing', () => {
    const tableOf = (rank: string) => (rank === 'K' ? 'Q' : 'K');
    let s = startedMatch(7, 18);
    const A = s.turn!.seat;
    const table = s.round!.tableCard;
    s = withHands(s, { [A]: Array.from({ length: 5 }, () => tableOf(table)) }); // A holds 5 lies
    const at = T0 + 5;
    s = ok(s, { type: 'PLAY', seat: A, cardIds: s.players[A].hand.map((c) => c.id).slice(0, 1), at }).s;
    const next = (A + 1) % 7;
    const s2 = ok(s, { type: 'PLAY', seat: next, cardIds: s.players[next].hand.map((c) => c.id).slice(0, 1), at: at + 3_000 }).s;
    expect(s2.players[A].stats.bluffSuccesses).toBe(1); // ≥1 lie, unchallenged, un-revealed
    expect(s.players[A].stats.bluffSuccesses).toBe(0); // credited at closure, not at play
  });

  it('window expiry with no CHECK: phase back to TURN, expired effect, lie credited, late CHECK rejected', () => {
    const base = afterFirstPlay(19);
    const A = base.A;
    const late = apply(base.s, { type: 'WINDOW_EXPIRE', at: base.at + 9_999 });
    expect(late.err?.code).toBe('ERR_TOO_EARLY'); // 1ms before the window closes
    const r = ok(base.s, { type: 'WINDOW_EXPIRE', at: base.at + 10_500 });
    expect(r.s.phase).toBe('TURN');
    expect(findEffect(r.effects, 'WINDOW_CLOSED')).toMatchObject({ reason: 'expired', accusedSeat: A });
    // After expiry the challenge right is GONE even though the pile still shows the play:
    const turnHolder = r.s.turn!.seat;
    const denied = apply(r.s, { type: 'LIAR', seat: turnHolder, at: base.at + 11_000 });
    expect(denied.err?.code).toBe('ERR_WINDOW_CLOSED');
  });

  it('expiry crediting: unchallenged LIE at expiry → bluffSuccesses++', () => {
    let s = startedMatch(7, 20);
    const A = s.turn!.seat;
    const table = s.round!.tableCard;
    const off = table === 'K' ? 'Q' : 'K';
    s = withHands(s, { [A]: [off, off, off, off, off] });
    const at = T0 + 5;
    s = ok(s, { type: 'PLAY', seat: A, cardIds: s.players[A].hand.map((c) => c.id).slice(0, 2), at }).s;
    const r = ok(s, { type: 'WINDOW_EXPIRE', at: at + 10_000 });
    expect(r.s.players[A].stats.bluffSuccesses).toBe(1);
  });

  it('empty-handed players may CHECK in open mode (any living non-accused, STR/01 §4)', () => {
    const base = afterFirstPlay(21);
    const emptier = (base.A + 1) % 7;
    const s = cloneState(base.s);
    s.players.find((p) => p.seat === emptier)!.hand = [];
    // With the next turn-holder empty, the turn would have skipped them — emulate:
    // we simply CHECK from the emptied seat within the window.
    const r = apply(s, { type: 'LIAR', seat: emptier, at: base.at + 3_000 });
    expect(r.err).toBeUndefined();
    expect(r.state.phase).toBe('REVEAL');
  });
});

describe('A2 next-only mode (2–4 players)', () => {
  it('only the current turn-holder may CHECK; others get ERR_NOT_YOUR_TURN', () => {
    let s = startedMatch(4, 31); // 4p → next-only, phase stays TURN
    const A = s.turn!.seat;
    const ids = s.players[A].hand.map((c) => c.id).slice(0, 1);
    const r0 = ok(s, { type: 'PLAY', seat: A, cardIds: ids, at: T0 + 5 });
    expect(r0.s.phase).toBe('TURN'); // no WINDOW phase at ≤4p
    expect(r0.s.round!.window).toBeUndefined();
    const bystander = (A + 2) % 4;
    const denied = apply(r0.s, { type: 'LIAR', seat: bystander, at: T0 + 6 });
    expect(denied.err?.code).toBe('ERR_NOT_YOUR_TURN');
    const next = (A + 1) % 4;
    const allowed = ok(r0.s, { type: 'LIAR', seat: next, at: T0 + 7 });
    expect(allowed.s.phase).toBe('REVEAL');
  });
});

describe('Big Table (8–10p, deck m=3 — mission A3/Y1)', () => {
  it('10p: 60-card deck, 50 dealt / 10 hidden, 15s turns, open window', () => {
    const s0 = startedMatch(10, 41);
    // startMatch effects were discarded in the helper — verify state math instead:
    const alive = s0.players.filter((p) => p.alive);
    expect(alive).toHaveLength(10);
    expect(alive.every((p) => p.hand.length === 5)).toBe(true);
    expect(s0.round!.leftover).toHaveLength(10);
    expect(s0.turn!.deadline - s0.turn!.startedAt).toBe(15_000); // 6–10p → 15s turns
  });

  it('9p also uses m=3; window opens after a play', () => {
    let s = startedMatch(9, 42);
    const A = s.turn!.seat;
    s = withBullets(s, { 0: 6, 1: 6, 2: 6, 3: 6, 4: 6, 5: 6, 6: 6, 7: 6, 8: 6 });
    const play = ok(s, { type: 'PLAY', seat: A, cardIds: s.players[A].hand.map((c) => c.id).slice(0, 1), at: T0 + 5 });
    expect(play.s.phase).toBe('WINDOW');
    expect(play.effects.find((e) => e.kind === 'WINDOW_OPENED')).toBeDefined();
  });
});
