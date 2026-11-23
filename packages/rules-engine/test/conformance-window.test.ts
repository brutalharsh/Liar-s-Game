/**
 * STR/01 §4 (A2) conformance — window config, clocks & the alive-count flip.
 *
 * window.test pins the default-number flow at a fixed 7p/9p/10p. NOT yet
 * pinned anywhere, pinned here:
 *   - the A2/A4 config knobs themselves (2s arm / 10s window / 60s grace);
 *   - window clocks are data-driven offsets of the play time (armedAt =
 *     at + armDelayMs, closesAt = at + windowMs) with inclusive boundaries
 *     at BOTH ends under custom durations, not just the defaults;
 *   - README interp. #2: mode AND timers follow the CURRENT ALIVE count — a
 *     6p match keeps opening windows at 6 and 5 alive, then flips to
 *     next-only at 4 alive mid-match, while the deck stays capacity-driven
 *     (m = ceil(6/4) = 2 at every stage);
 *   - windowMode: 'next-only' override suppresses windows at a 7p table.
 */
import { describe, expect, it } from 'vitest';
import { apply, createMatch } from '../src/engine';
import { DEFAULT_MATCH_CONFIG } from '../src/types';
import type { Effect, GameState, MatchConfig, TableRank } from '../src/types';
import { handIds, ok, roster, startedMatch, T0, turnSeat, withBullets, withHands } from './helpers';

const offOf = (t: TableRank): TableRank => (t === 'K' ? 'Q' : 'K');
const aliveCount = (s: GameState): number => s.players.filter((p) => p.alive).length;

function findEffect<T extends Effect['kind']>(effects: Effect[], kind: T) {
  return effects.find((e) => e.kind === kind) as Extract<Effect, { kind: T }> | undefined;
}

describe('STR/01 A2/A4 — window & timer config representation', () => {
  it('defaults: 2s arm delay, 10s window, 60s disconnect grace, auto mode, no fast toggle', () => {
    expect(DEFAULT_MATCH_CONFIG).toEqual({
      fastMode: false,
      turnTimerMsOverride: undefined,
      windowMode: 'auto',
      armDelayMs: 2_000,
      windowMs: 10_000,
      disconnectGraceMs: 60_000,
    });
  });

  it('window clocks are offsets of the play time; NOT_ARMED before arm delay, inclusive at BOTH boundaries, rejected after close', () => {
    const config: MatchConfig = { ...DEFAULT_MATCH_CONFIG, armDelayMs: 600, windowMs: 4_000 };
    let s = apply(
      createMatch({ roster: roster(7), seed: 9401, config }),
      { type: 'MATCH_START', at: T0 },
    ).state;
    s = apply(s, { type: 'BEGIN_TURNS', at: T0 + 1 }).state;
    const A = turnSeat(s);
    const at = T0 + 5;
    const r = ok(s, { type: 'PLAY', seat: A, cardIds: handIds(s, A).slice(0, 1), at });
    expect(r.s.phase).toBe('WINDOW');
    expect(findEffect(r.effects, 'WINDOW_OPENED')).toMatchObject({
      accusedSeat: A, openedAt: at, armedAt: at + 600, closesAt: at + 4_000,
    });
    expect(r.s.round!.window).toMatchObject({ armedAt: at + 600, closesAt: at + 4_000 });

    // Each probe branches from the same post-play window state (apply is pure):
    const w = r.s;
    expect(apply(w, { type: 'LIAR', seat: (A + 2) % 7, at: at + 599 }).err?.code).toBe('ERR_WINDOW_NOT_ARMED');
    const early = apply(w, { type: 'LIAR', seat: (A + 3) % 7, at: at + 600 }); // == armedAt
    expect(early.err).toBeUndefined();
    expect(early.state.phase).toBe('REVEAL');
    const atClose = apply(w, { type: 'LIAR', seat: (A + 4) % 7, at: at + 4_000 }); // == closesAt
    expect(atClose.err).toBeUndefined();
    expect(atClose.state.phase).toBe('REVEAL');
    expect(apply(w, { type: 'LIAR', seat: (A + 5) % 7, at: at + 4_001 }).err?.code).toBe('ERR_WINDOW_CLOSED');
  });

  it('alive-count derivation: windows at 6 and 5 alive, next-only at 4 alive; timers 15s→20s; deck stays 40 cards', () => {
    let s = startedMatch(6, 9402);
    expect(aliveCount(s)).toBe(6);
    expect(s.turn!.deadline - s.turn!.startedAt).toBe(15_000); // §3: 15s @6–10p

    // ── round 1 (6 alive → open window): starter lies, is caught, dies ──────
    const L1 = turnSeat(s);
    s = withBullets(s, { [L1]: 1 });
    let off = offOf(s.round!.tableCard);
    s = withHands(s, { [L1]: [off, off, off, off, off] });
    const t1 = T0 + 10;
    const p1 = ok(s, { type: 'PLAY', seat: L1, cardIds: handIds(s, L1).slice(0, 1), at: t1 });
    expect(p1.effects.filter((e) => e.kind === 'WINDOW_OPENED')).toHaveLength(1);
    let r = ok(p1.s, { type: 'LIAR', seat: p1.s.turn!.seat, at: t1 + 3_000 }); // past the 2s arm
    r = ok(r.s, { type: 'REVEAL_ACK', at: t1 + 4_000 });
    s = ok(r.s, { type: 'SHOT_ACK', at: t1 + 5_000 }).s;
    expect(s.players.find((p) => p.seat === L1)!.alive).toBe(false);
    expect(aliveCount(s)).toBe(5);
    expect(s.phase).toBe('ROUND_END');
    const L2 = s.pendingStarter!; // caught-liar designation, dead → next living ccw
    expect(L2).not.toBe(L1);

    // ── round 2 (5 alive → still open window per §4 "5–10 players") ────────
    s = withBullets(s, { [L2]: 1 });
    s = ok(s, { type: 'NEXT_ROUND', at: t1 + 6_000 }).s;
    expect(s.round!.leftover).toHaveLength(40 - 25); // deck stays CAPACITY-driven: m=2, 5×5 dealt
    s = ok(s, { type: 'BEGIN_TURNS', at: t1 + 6_100 }).s;
    expect(turnSeat(s)).toBe(L2);
    expect(s.turn!.deadline - s.turn!.startedAt).toBe(20_000); // §3: 20s @4–5p
    off = offOf(s.round!.tableCard);
    s = withHands(s, { [L2]: [off, off, off, off, off] });
    const t2 = t1 + 10_000;
    const p2 = ok(s, { type: 'PLAY', seat: L2, cardIds: handIds(s, L2).slice(0, 1), at: t2 });
    expect(p2.effects.filter((e) => e.kind === 'WINDOW_OPENED')).toHaveLength(1);
    r = ok(p2.s, { type: 'LIAR', seat: p2.s.turn!.seat, at: t2 + 3_000 });
    r = ok(r.s, { type: 'REVEAL_ACK', at: t2 + 4_000 });
    s = ok(r.s, { type: 'SHOT_ACK', at: t2 + 5_000 }).s;
    expect(aliveCount(s)).toBe(4);
    expect(s.phase).toBe('ROUND_END');
    const L3 = s.pendingStarter!;
    expect([L1, L2]).not.toContain(L3);

    // ── round 3 (4 alive → next-only): no window EVER opens; 20s turns ──────
    s = ok(s, { type: 'NEXT_ROUND', at: t2 + 6_000 }).s;
    expect(s.round!.leftover).toHaveLength(40 - 20); // same 40-card deck, 4×5 dealt
    s = ok(s, { type: 'BEGIN_TURNS', at: t2 + 6_100 }).s;
    expect(turnSeat(s)).toBe(L3);
    expect(s.turn!.deadline - s.turn!.startedAt).toBe(20_000);
    off = offOf(s.round!.tableCard);
    s = withHands(s, { [L3]: [off, off, off, off, off] });
    const t3 = t2 + 10_000;
    const p3 = ok(s, { type: 'PLAY', seat: L3, cardIds: handIds(s, L3).slice(0, 1), at: t3 });
    expect(p3.s.phase).toBe('TURN'); // the flip: 4 alive → NO window phase
    expect(p3.s.round!.window).toBeUndefined();
    expect(p3.effects.filter((e) => e.kind === 'WINDOW_OPENED')).toHaveLength(0);
    expect(p3.s.turn!.deadline).toBe(t3 + 20_000); // onPlay timer is alive-count derived too

    // Next-only rights at 4 alive: bystanders rejected, the turn holder may call.
    const holder = p3.s.turn!.seat;
    const bystander = p3.s.players.find((p) => p.alive && p.seat !== L3 && p.seat !== holder)!.seat;
    expect(apply(p3.s, { type: 'LIAR', seat: bystander, at: t3 + 2 }).err?.code).toBe('ERR_NOT_YOUR_TURN');
    const called = ok(p3.s, { type: 'LIAR', seat: holder, at: t3 + 3 });
    expect(called.s.round!.resolution).toMatchObject({ accusedSeat: L3, loserSeat: L3 });
    r = ok(called.s, { type: 'REVEAL_ACK', at: t3 + 4 });
    s = ok(r.s, { type: 'SHOT_ACK', at: t3 + 5 }).s;
    expect(s.phase).toBe('ROUND_END'); // 3 alive → the match carries on
  });

  it('windowMode override "next-only": a 7p table never opens a window; only the next holder may call', () => {
    let s = apply(
      createMatch({ roster: roster(7), seed: 9403, config: { windowMode: 'next-only' } }),
      { type: 'MATCH_START', at: T0 },
    ).state;
    s = apply(s, { type: 'BEGIN_TURNS', at: T0 + 1 }).state;
    const A = turnSeat(s);
    const r = ok(s, { type: 'PLAY', seat: A, cardIds: handIds(s, A).slice(0, 1), at: T0 + 5 });
    expect(r.s.phase).toBe('TURN');
    expect(r.s.round!.window).toBeUndefined();
    expect(r.effects.filter((e) => e.kind === 'WINDOW_OPENED')).toHaveLength(0);
    expect(apply(r.s, { type: 'LIAR', seat: (A + 3) % 7, at: T0 + 6 }).err?.code).toBe('ERR_NOT_YOUR_TURN');
    expect(ok(r.s, { type: 'LIAR', seat: turnSeat(r.s), at: T0 + 7 }).s.phase).toBe('REVEAL');
  });
});
