/**
 * FLOW (a) — 5–7 player open-window mode (STR/01 §4, amendment A2):
 *   - arm-delay window: a CHECK before `armedAt` bounces ERR_WINDOW_NOT_ARMED
 *     and mutates NOTHING; at EXACTLY `armedAt` it lands (inclusive bound);
 *   - inclusive close bound: a CHECK at EXACTLY `closesAt` lands; one ms late
 *     is ERR_WINDOW_CLOSED with the window still engine-intact;
 *   - first-wins: two near-simultaneous CHECKs — exactly one resolves, the
 *     loser gets the typed rejection;
 *   - late CHECK: after the window expires naturally (engine clock authority)
 *     even the turn-holder cannot challenge the dead play, and the turn slot
 *     survives the rollover so play continues;
 *   - guard rails while a window is live: self-challenge + wrong accused.
 *
 * Clock note: `deps.now` is read LIVE by the manager, runtime and wheel, so a
 * mutable `now` lets every probe hit the EXACT engine boundary ms through the
 * full router path (no sleep-racing). The wheel still converts absolute `at`
 * values into REAL setTimeout delays, so pacing + natural expiry keep running.
 *
 * bulletPos pin: server-internal white-box antic (same class as the existing
 * tests' `wheel.force()`): pinned to 6 so first pulls are always BLANK — 5
 * alive players stay 5, open-window mode never silently degrades to next-only,
 * and rounds keep cycling for multi-window probes. Never sent on the wire.
 */
import { describe, expect, it } from 'vitest';
import { FAST_MATCH_CONFIG, FAST_TIMING, TestEnv, bootMatch, waitFor } from './helpers.js';

const WINDOW_CONFIG = {
  ...FAST_MATCH_CONFIG,
  turnTimerMsOverride: 2_000, // probes never collide with auto-play
  armDelayMs: 300,
  windowMs: 1_200,
};

interface WireCard {
  id: string;
  rank: string;
}

interface WindowBoot {
  env: TestEnv;
  code: string;
  sockets: import('./helpers.js').FakeSocket[];
  holder: number;
  /** The probes advance this — deps.now reads it live. */
  box: { now: number };
}

/** Boots N (5..7) fresh players + first turn, pins the revolvers BLANK. */
async function bootWindowTable(playerCount: number): Promise<WindowBoot> {
  const env = new TestEnv({ matchConfig: WINDOW_CONFIG, timing: FAST_TIMING });
  const box = { now: Date.now() };
  env.deps.now = () => box.now;

  const { code, sockets } = await bootMatch(env, playerCount, {
    start: true,
    capacity: playerCount,
    drivers: false,
  });
  const dealt = await waitFor(
    () => sockets.every((s) => s.received('turn:begin').length > 0),
    5_000,
    2,
  );
  if (!dealt) throw new Error('hands + first turn never arrived');

  const room = env.manager.roomByCode(code)!;
  for (const p of room.match!.engineState.players) p.bulletPos = 6; // pulls #1..5 all BLANK

  const holder = sockets[0]!.last('turn:begin')!['seat'] as number;
  return { env, code, sockets, holder, box };
}

/** The current turn holder plays one card (full router path). */
async function playOne(env: TestEnv, sockets: WindowBoot['sockets'], seat: number): Promise<string> {
  const hand = sockets[seat]!.last('hand:deal')!['cards'] as WireCard[];
  const res = await sockets[seat]!.client('play:cards', { cardIds: [hand[0]!.id] });
  if (!res?.ok) throw new Error(`play from seat ${seat} failed: ${JSON.stringify(res?.error)}`);
  return hand[0]!.id;
}

function engineWindow(env: TestEnv, code: string): { armedAt: number; closesAt: number; accusedSeat: number } {
  const w = env.manager.roomByCode(code)!.match!.engineState.round!.window;
  if (!w) throw new Error('no open window');
  return w;
}

describe('FLOW open-window mode (5p): arm delay, inclusive bounds, first-wins, late CHECK', () => {
  it('arm delay: pre-arm CHECK bounces; at armedAt+0 it lands and closes liar_called BEFORE reveal:show', async () => {
    const { env, code, sockets, holder, box } = await bootWindowTable(5);
    await playOne(env, sockets, holder);

    // window:open hit every socket with the accused seat + exact close stamp.
    const w = engineWindow(env, code);
    expect(w.accusedSeat).toBe(holder);
    for (const s of sockets) {
      const open = s.last('window:open')!;
      expect(open['playSeat']).toBe(holder);
      expect(open['closesAtTs']).toBe(w.closesAt);
    }

    const caller = (holder + 1) % 5;
    // guard rails while the window is live (rejections, not consumption):
    const selfAct = await sockets[holder]!.client('liar:call', { accusedSeat: holder });
    expect((selfAct?.error as { code: string }).code).toBe('ERR_SELF_CHALLENGE');
    const wrongAct = await sockets[caller]!.client('liar:call', { accusedSeat: (holder + 2) % 5 });
    expect((wrongAct?.error as { code: string }).code).toBe('ERR_WRONG_ACCUSED');

    // pre-arm: ERR_WINDOW_NOT_ARMED, and NOTHING changed.
    const pre = await sockets[caller]!.client('liar:call', { accusedSeat: holder });
    expect(pre?.ok).toBe(false);
    expect((pre?.error as { code: string }).code).toBe('ERR_WINDOW_NOT_ARMED');
    const state = env.manager.roomByCode(code)!.match!.engineState;
    expect(state.phase).toBe('WINDOW');
    expect(state.round!.pile.length).toBe(1);
    expect(env.manager.roomByCode(code)!.wheel.has('window')).toBe(true);

    // EXACT inclusive arm bound: at === armedAt the CHECK is legal.
    box.now = w.armedAt;
    const ack = await sockets[caller]!.client('liar:call', { accusedSeat: holder });
    expect(ack?.ok).toBe(true);

    // Wire order: window:close {liar_called} lands BEFORE reveal:show (effect order).
    const stream = sockets[0]!.emissions;
    const closedAt = stream.findIndex((e) => e.event === 'window:close');
    const revealedAt = stream.findIndex((e) => e.event === 'reveal:show');
    expect(closedAt).toBeGreaterThanOrEqual(0);
    expect(revealedAt).toBeGreaterThan(closedAt);
    expect(stream[closedAt]!.payload['reason']).toBe('liar_called');

    const res = env.manager.roomByCode(code)!.match!.engineState.round!.resolution!;
    expect(res.challengerSeat).toBe(caller);
    expect(res.accusedSeat).toBe(holder);

    // BLANK roulette → the round cycles: round 2 is dealt.
    const cycled = await waitFor(
      () => sockets[0]!.received('round:new').length >= 2,
      5_000,
      5,
    );
    expect(cycled).toBe(true);
  }, 20_000);

  it('inclusive close bound: a CHECK at EXACTLY closesAt lands (1ms window, not 10s window)', async () => {
    const { env, code, sockets, holder, box } = await bootWindowTable(5);
    await playOne(env, sockets, holder);
    const w = engineWindow(env, code);

    box.now = w.closesAt; // the very last legal ms (engine: ev.at > closesAt rejects)
    const ack = await sockets[(holder + 1) % 5]!.client('liar:call', { accusedSeat: holder });
    expect(ack?.ok).toBe(true);

    const state = env.manager.roomByCode(code)!.match!.engineState;
    expect(state.phase).toBe('REVEAL');
    expect(state.round!.window).toBeUndefined();
    expect(state.round!.resolution!.challengerSeat).toBe((holder + 1) % 5);
  }, 20_000);

  it('late CHECK: past closesAt is ERR_WINDOW_CLOSED (window intact) → natural expiry → even the holder cannot challenge the dead play', async () => {
    const { env, code, sockets, holder, box } = await bootWindowTable(5);
    await playOne(env, sockets, holder);
    const w = engineWindow(env, code);

    box.now = w.closesAt + 1; // one ms late — the ENGINE rejects (not the timer)
    const late = await sockets[(holder + 1) % 5]!.client('liar:call', { accusedSeat: holder });
    expect(late?.ok).toBe(false);
    expect((late?.error as { code: string }).code).toBe('ERR_WINDOW_CLOSED');
    const afterReject = env.manager.roomByCode(code)!.match!.engineState;
    expect(afterReject.phase).toBe('WINDOW');
    expect(env.manager.roomByCode(code)!.wheel.has('window')).toBe(true);

    // let it expire NATURALLY (wheel at the engine's closesAt) — once, reason expired
    const expired = await waitFor(
      () => sockets[0]!.last('window:close')?.['reason'] === 'expired',
      4_000,
      5,
    );
    expect(expired).toBe(true);
    const state = env.manager.roomByCode(code)!.match!.engineState;
    expect(state.phase).toBe('TURN');
    expect(state.round!.window).toBeUndefined();

    // late CHECK after expiry: even the CURRENT turn holder is refused.
    const turnSeat = state.turn!.seat;
    const byHolder = await sockets[turnSeat]!.client('liar:call', { accusedSeat: holder });
    expect((byHolder?.error as { code: string }).code).toBe('ERR_WINDOW_CLOSED');
    const byOther = await sockets[(holder + 2) % 5]!.client('liar:call', { accusedSeat: holder });
    expect((byOther?.error as { code: string }).code).toBe('ERR_WINDOW_CLOSED');
    expect(state.turn!.seat).toBe(turnSeat); // rejections moved nothing

    // the turn survived the rollover: the holder can still PLAY (fresh window).
    await playOne(env, sockets, turnSeat);
    const w2 = engineWindow(env, code);
    expect(w2.accusedSeat).toBe(turnSeat);
    expect(sockets[0]!.received('window:open').length).toBe(2);
  }, 20_000);

  it('first-wins: two near-simultaneous CHECKs — exactly one resolves, the loser gets ERR_WRONG_PHASE', async () => {
    const { env, code, sockets, holder, box } = await bootWindowTable(5);
    await playOne(env, sockets, holder);
    const w = engineWindow(env, code);
    box.now = w.armedAt + 10; // armed for both

    const c1 = (holder + 1) % 5;
    const c2 = (holder + 2) % 5;
    const [r1, r2] = await Promise.all([
      sockets[c1]!.client('liar:call', { accusedSeat: holder }),
      sockets[c2]!.client('liar:call', { accusedSeat: holder }),
    ]);
    const oks = [r1, r2].filter((r) => r?.ok);
    expect(oks.length).toBe(1); // STR/01 §4: first event wins — no race, no double resolution
    const losingAck = [r1, r2].find((r) => !r?.ok)!;
    expect((losingAck.error as { code: string }).code).toBe('ERR_WRONG_PHASE');

    // exactly one resolution on the wire + engine
    expect(sockets[0]!.received('reveal:show').length).toBe(1);
    const res = env.manager.roomByCode(code)!.match!.engineState.round!.resolution!;
    const winnerSeat = res.challengerSeat;
    expect([c1, c2]).toContain(winnerSeat);

    const cycled = await waitFor(
      () => sockets[0]!.received('round:new').length >= 2,
      5_000,
      5,
    );
    expect(cycled).toBe(true);
  }, 20_000);

  it('7-player full house: the same arm discipline holds (open windows derive from ALIVE count ≥5)', async () => {
    const { env, code, sockets, holder, box } = await bootWindowTable(7);
    await playOne(env, sockets, holder);
    const w = engineWindow(env, code);

    for (const s of sockets) {
      const open = s.last('window:open')!;
      expect(open['playSeat']).toBe(holder);
      expect(open['closesAtTs']).toBe(w.closesAt);
    }

    const pre = await sockets[(holder + 3) % 7]!.client('liar:call', { accusedSeat: holder });
    expect((pre?.error as { code: string }).code).toBe('ERR_WINDOW_NOT_ARMED');

    box.now = w.armedAt;
    const ack = await sockets[(holder + 3) % 7]!.client('liar:call', { accusedSeat: holder });
    expect(ack?.ok).toBe(true);
    expect(
      env.manager.roomByCode(code)!.match!.engineState.players.every((p) => p.alive),
    ).toBe(true); // BLANK pin — a full house keeps playing
  }, 20_000);
});
