/**
 * Timer wheel, reconnection/presence, grace + abandon, abort-by-default,
 * exactly-once expiry, seq catch-up. Everything reacts to the ENGINE's clock
 * fields; the wheel is only the delivery mechanism.
 *
 * Timers here run REAL with tiny injected config
 * (turn 400ms · arm 5ms · window 500ms · grace 250ms · pacing 1-4ms).
 */
import { assert, describe, expect, it } from 'vitest';
import {
  FAST_MATCH_CONFIG,
  FAST_TIMING,
  TestEnv,
  bootMatch,
  joinRoom,
  waitFor,
  waitForHandsAndTurn,
} from './helpers.js';

function playCount(env: TestEnv, code: string): number {
  return env.manager.roomByCode(code)!.match!.engineState.round?.pile.length ?? 0;
}

/** Boots a driver-free two- or N-player match and waits for the first turn. */
async function bootManual(players: number) {
  const env = new TestEnv({ matchConfig: FAST_MATCH_CONFIG, timing: FAST_TIMING });
  const { code, sockets } = await bootMatch(env, players, { start: true, drivers: false });
  const seat = await waitForHandsAndTurn(env, sockets);
  return { env, code, sockets, seat };
}

describe('TimerWheel exactly-once + cancel semantics', () => {
  it('natural deadline fires once; forced double-fires afterwards add ZERO plays', async () => {
    const { env, code, sockets } = await bootManual(2);

    const fired = await waitFor(() => playCount(env, code) === 1, 5_000, 10);
    expect(fired).toBe(true);
    expect(sockets[0]!.received('play:accept').length).toBe(1);

    // The slot is dead after its natural fire — double-force is a no-op; the
    // NEXT turn's freshly armed slot only earns ERR_TOO_EARLY + re-arm.
    const room = env.manager.roomByCode(code)!;
    room.wheel.force('turn');
    room.wheel.force('turn');
    await new Promise((r) => setTimeout(r, 60));
    expect(sockets[0]!.received('play:accept').length).toBe(1);
    expect(playCount(env, code)).toBe(1);
  }, 15_000);

  it('a cancelled slot never fires (late-cancel safety)', async () => {
    const { env, code } = await bootManual(2);
    const room = env.manager.roomByCode(code)!;
    expect(room.wheel.has('turn')).toBe(true);
    room.wheel.cancel('turn');
    expect(room.wheel.has('turn')).toBe(false);
    room.wheel.force('turn'); // slot already gone → no-op by construction
    await new Promise((r) => setTimeout(r, 120));
    expect(playCount(env, code)).toBe(0); // nobody auto-played
  }, 15_000);

  it('illegal early fires are rejected by the engine and re-armed (drift-safe)', async () => {
    const { env, code, sockets } = await bootManual(2);
    const room = env.manager.roomByCode(code)!;

    // Force while the deadline is still in the future → engine rejects with
    // ERR_TOO_EARLY (rejected events mutate nothing but the log).
    room.wheel.force('turn');
    await new Promise((r) => setTimeout(r, 20));
    expect(playCount(env, code)).toBe(0);
    expect(room.match!.engineState.log.some((l) => !l.accepted)).toBe(true);

    const fired = await waitFor(() => playCount(env, code) === 1, 4_000, 20);
    expect(fired).toBe(true);
    const state = room.match!.engineState;
    assert(state.round !== null);
    expect(state.round.pile.length).toBe(1);
    void sockets;
  }, 15_000);
});

describe('window expiry — auto close + rollover (5p open-window mode)', () => {
  it('window:close {reason: "expired"} lands exactly once; the turn slot survives', async () => {
    // Turn timer (700ms) OUTLIVES the window (200ms) so nothing can "believe"
    // it shut early; the window must expire on its own.
    const env = new TestEnv({
      matchConfig: { ...FAST_MATCH_CONFIG, turnTimerMsOverride: 700, windowMs: 200 },
      timing: FAST_TIMING,
    });
    const { code, sockets } = await bootMatch(env, 5, { start: true, drivers: false });
    const seat = await waitForHandsAndTurn(env, sockets);
    const room = env.manager.roomByCode(code)!;

    const hand = sockets[seat]!.last('hand:deal')!['cards'] as { id: string }[];
    const played = await sockets[seat]!.client('play:cards', { cardIds: [hand[0]!.id] });
    expect(played?.ok).toBe(true);

    const windowOpened = await waitFor(
      () => sockets[0]!.received('window:open').length > 0,
      3_000,
      2,
    );
    expect(windowOpened).toBe(true);
    expect(room.wheel.has('window')).toBe(true);

    // Let the window EXPIRE naturally (engine clock authority), then double-
    // force the dead slot: exactly one window:close may ever land.
    const closed = await waitFor(
      () => sockets[0]!.received('window:close').length > 0,
      3_000,
      20,
    );
    expect(closed).toBe(true);
    expect(sockets[0]!.received('window:close')[0]!['reason']).toBe('expired');
    room.wheel.force('window');
    room.wheel.force('window');
    await new Promise((r) => setTimeout(r, 60));
    expect(sockets[0]!.received('window:close').length).toBe(1);
    expect(room.match!.engineState.phase).toBe('TURN');
    // Turn slot survived the window rollover (next holder's clock runs on).
    expect(room.wheel.has('turn')).toBe(true);
  }, 20_000);
});

describe('disconnect → grace → reconnect / abandon', () => {
  it('reconnect within grace restores the seat, cancels grace, resends the CURRENT snapshot', async () => {
    const { env, code, sockets, seat } = await bootManual(2);
    const witness = sockets[seat === 0 ? 1 : 0]!;
    const dropping = sockets[seat]!;
    const seqBefore = dropping.last('round:new')!['seq'] as number;

    dropping.disconnect();
    const disconnectedShown = await waitFor(
      () => {
        const p = witness.last('presence:update');
        if (!p) return false;
        const seats = p['seats'] as { seat: number; connected: boolean }[];
        const mine = seats.find((s) => s.seat === seat);
        return mine !== undefined && mine.connected === false;
      },
      3_000,
      2,
    );
    expect(disconnectedShown).toBe(true);

    env.detach(dropping);
    const back = env.socket(env.user(`u${seat}`), '10.9.9.9');
    const rejoined = await joinRoom(env, back, code);
    expect(rejoined.yourSeat).toBe(seat);
    expect(rejoined.reconnected).toBe(true);

    // Fresh full catch-up snapshot on rejoin (STR/07 §4): current sequence —
    // never reset — the client closes its own gap from here.
    const snap = back.last('lobby:state')!;
    expect(snap['seq'] as number).toBeGreaterThanOrEqual(seqBefore);
    expect(snap['phase']).toBe('playing');
    expect(snap['roundNo']).toBeDefined();
    const seatings = snap['seats'] as { seat: number; connected: boolean }[];
    expect(seatings.find((s) => s.seat === seat)!.connected).toBe(true);

    const enginePlayer = env.manager
      .roomByCode(code)!
      .match!.engineState.players.find((p) => p.seat === seat)!;
    expect(enginePlayer.disconnectedAt).toBeUndefined();
    expect(enginePlayer.abandoned).toBe(false);
    expect(env.manager.roomByCode(code)!.wheel.has(`grace:u${seat}`)).toBe(false);
  }, 15_000);

  it('grace expiry ABANDONs the seat; drunk-under-the-table auto-play resumes (3p table)', async () => {
    // 2p would ABORT here (win-by-default, <2 present) — correct engine
    // semantics; the abandoned auto-play only continues with 2+ players left.
    const env = new TestEnv({ matchConfig: FAST_MATCH_CONFIG, timing: FAST_TIMING });
    const { code, sockets } = await bootMatch(env, 3, { start: true, drivers: false });
    const seat = await waitForHandsAndTurn(env, sockets);
    const witness = sockets.find((s) => s !== sockets[seat])!;
    sockets[seat]!.disconnect();
    env.detach(sockets[seat]!);

    const abandoned = await waitFor(
      () => {
        const room = env.manager.roomByCode(code)!;
        return room.match!.engineState.players.find((p) => p.seat === seat)!.abandoned === true;
      },
      4_000,
      10,
    );
    expect(abandoned).toBe(true);
    // Match survives (2 present-alive remain).
    expect(env.manager.roomByCode(code)!.match!.isOver).toBe(false);

    const presence = witness.last('presence:update')!;
    const mine = (presence['seats'] as { seat: number; connected: boolean; afk: boolean }[]).find(
      (s) => s.seat === seat,
    )!;
    expect(mine.afk).toBe(true);

    const played = await waitFor(
      () => witness.received('play:accept').length > 0,
      4_000,
      10,
    );
    expect(played).toBe(true);
    const anyPlay = witness.received('play:accept')[0]!;
    expect(anyPlay['seat']).toBe(seat); // their own auto-play, "disconnect" flavor
  }, 20_000);

  it('abort <2-alive: the remaining player wins by default; one game:over + one hook', async () => {
    const { env, code, sockets, seat } = await bootManual(2);
    const survivorSeat = seat === 0 ? 1 : 0;
    sockets[seat]!.disconnect();
    env.detach(sockets[seat]!);

    const over = await waitFor(
      () => env.manager.roomByCode(code)?.match?.isOver ?? false,
      6_000,
      10,
    );
    expect(over).toBe(true);

    const room = env.manager.roomByCode(code)!;
    const record = room.match!.engineState.matchRecord!;
    expect(record.aborted).toBe(true);
    expect(record.winnerSeat).toBe(survivorSeat);

    expect(env.matchEnds.length).toBe(1);
    expect(env.matchEnds[0]!.record.aborted).toBe(true);
    expect(env.matchEnds[0]!.record.winnerSeat).toBe(survivorSeat);
    expect(env.matchEnds[0]!.seed).toBeGreaterThan(0);
    expect(env.matchEnds[0]!.log.length).toBeGreaterThan(0);
    expect(env.matchEnds[0]!.endedAt instanceof Date).toBe(true);

    expect(sockets[survivorSeat]!.received('game:over').length).toBe(1);
    expect(sockets[survivorSeat]!.last('game:over')!['winnerSeat']).toBe(survivorSeat);
  }, 20_000);

  it('mid-match disconnects DEFER through REVEAL/SHOT (interpretation ⑧: roulette resolves)', async () => {
    const { env, code, sockets, seat: seat0 } = await bootManual(2);
    const seat1 = seat0 === 0 ? 1 : 0;
    const hand = sockets[seat0]!.last('hand:deal')!['cards'] as { id: string }[];
    await sockets[seat0]!.client('play:cards', { cardIds: [hand[0]!.id] });
    const call = await sockets[seat1]!.client('liar:call', { accusedSeat: seat0 });
    expect(call?.ok).toBe(true);
    const inReveal = await waitFor(
      () => env.manager.roomByCode(code)!.match!.engineState.phase === 'REVEAL',
      3_000,
      2,
    );
    expect(inReveal).toBe(true);
    // Disconnect the CHALLENGER mid-reveal: the pending roulette still resolves.
    sockets[seat1]!.disconnect();
    const resolvedShot = await waitFor(
      () => sockets[seat0]!.received('shot:result').length > 0,
      3_000,
      2,
    );
    expect(resolvedShot).toBe(true);
    const roundEnded = await waitFor(
      () => env.manager.roomByCode(code)!.match!.engineState.phase === 'ROUND_END',
      3_000,
      2,
    );
    expect(roundEnded).toBe(true);
  }, 20_000);
});

describe('seq catch-up strategy (gap → full snapshot on rejoin, STR/07 §4)', () => {
  it('a mid-match joiner gets one snapshot at the CURRENT seq; deltas continue past it', async () => {
    const { env, code, sockets } = await bootManual(2);

    const watcher = env.socket(env.user('late-comer'));
    const res = await watcher.client('room:join', { code });
    expect(res?.ok).toBe(true);
    const snap = watcher.last('lobby:state')!;
    const snapSeq = snap['seq'] as number;

    const room = env.manager.roomByCode(code)!;
    expect(snapSeq).toBe(room.seq); // no reset, no drift
    expect(snap['phase']).toBe('playing');

    const seat = sockets[0]!.last('turn:begin')!['seat'] as number;
    const hand = sockets[seat]!.last('hand:deal')!['cards'] as { id: string }[];
    const beforePlays = watcher.emissions.length;
    await sockets[seat]!.client('play:cards', { cardIds: [hand[0]!.id] });
    const newEvents = watcher.emissions.slice(beforePlays);
    expect(newEvents.length).toBeGreaterThan(0);
    for (const e of newEvents) {
      if (typeof e.payload['seq'] === 'number') {
        expect(e.payload['seq'] as number).toBeGreaterThan(snapSeq);
      }
    }
  }, 15_000);
});
