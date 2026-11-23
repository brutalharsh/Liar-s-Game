/**
 * RACE-CONDITION REGRESSIONS (A2 audit) — these tests pin interleavings the
 * happy-path suites (one clean `await` per action) cannot express. Every
 * case here was a REAL window where two flows touched the same room between
 * awaits/timer fires:
 *
 *  R1  double game:start (two rapid host taps) across the per-seat profile
 *      loads → exactly one match may begin (second tap: ILLEGAL_MOVE).
 *  R2  a seat change landing INSIDE the start's profile-load window (lobby
 *      leave mid-start) → the start aborts to the lobby; no TypeError on the
 *      freed seat, no half-roster runtime, room stays playable.
 *  R3  kickoff grace clocks: a seat dropped before the start gets its grace
 *      slot RE-ANCHORED to the ENGINE deadline at kickoff. The lobby-era
 *      slot would fire before the engine's grace elapses → ERR_TOO_EARLY →
 *      the one-shot slot is spent → ABANDON silently lost forever.
 *  R4  rooms vacated by a rebind (double room:create from one socket) get
 *      idle-GC'd — they used to leak forever with a live mirror row.
 *  R5  the onMatchEnd seam may throw synchronously without killing the
 *      process after game:over is already on the wire.
 *  R6  host promotion may pass through doomed seats in a lobby grace
 *      cascade, leaving a room permanently hostless; the next fresh sitter
 *      must claim host instead.
 */
import { describe, expect, it } from 'vitest';
import { apply, createMatch } from '@liars-game/rules-engine';
import type { GameState, MatchRecord as EngineMatchRecord } from '@liars-game/rules-engine';
import type { MatchEndPayload } from '../../src/game/types.js';
import {
  FAST_MATCH_CONFIG,
  FAST_TIMING,
  TestEnv,
  bootMatch,
  createRoom,
  joinRoom,
  waitFor,
  waitForHandsAndTurn,
} from './helpers.js';

/** Parks startMatch/roster profile loads until `release()` — the race window. */
function gateProfiles(env: TestEnv): { release: () => void; loads: () => number } {
  let releaseProfiles!: () => void;
  let count = 0;
  const parked = new Promise<void>((resolve) => {
    releaseProfiles = resolve;
  });
  env.deps.userProfile = async () => {
    count += 1;
    await parked;
    return { avatarSpec: null, activeTitle: null };
  };
  return { release: releaseProfiles, loads: () => count };
}

/** Deterministic engine-produced MatchRecord (2-seat instant abort). */
function abortedRecord(): EngineMatchRecord {
  let s: GameState = createMatch({
    roster: [
      { seat: 0, accountId: 'a', nickname: 'Alpha' },
      { seat: 1, accountId: 'b', nickname: 'Beta' },
    ],
    seed: 20261123,
  });
  s = apply(s, { type: 'MATCH_START', at: 0 }).state;
  s = apply(s, { type: 'LEAVE', seat: 1, at: 1 }).state; // <2 present → abort
  if (!s.matchRecord) throw new Error('engine did not finish the match');
  return s.matchRecord;
}

// ─────────────────────────────────────────────────────────────────────────────

describe('R1 — double game:start across the profile-load window', () => {
  it('two rapid host taps: exactly one ack ok, one ILLEGAL_MOVE, exactly one deal', async () => {
    const env = new TestEnv({ matchConfig: FAST_MATCH_CONFIG, timing: FAST_TIMING });
    const { sockets } = await bootMatch(env, 2, { start: false, drivers: false });
    const host = sockets[0]!;
    const gate = gateProfiles(env);

    // The racing double-tap: two game:start events, no await in between.
    const tapA = host.client('game:start', {});
    const tapB = host.client('game:start', {});
    const parked = await waitFor(() => gate.loads() >= 1, 3_000, 2);
    expect(parked).toBe(true);

    gate.release();
    const [resA, resB] = await Promise.all([tapA, tapB]);
    const outcomes = [resA, resB].map((r) =>
      r?.ok ? 'ok' : (r?.error as { code: string } | undefined)?.code ?? 'none',
    );
    expect(outcomes.filter((o) => o === 'ok')).toHaveLength(1);
    expect(outcomes.filter((o) => o === 'ILLEGAL_MOVE')).toHaveLength(1);
    expect(gate.loads()).toBe(2); // the winner loaded each seat exactly once

    const started = await waitFor(() => host.received('round:new').length === 1, 3_000, 2);
    expect(started).toBe(true);
    expect(sockets.map((s) => s.received('hand:deal').length)).toEqual([1, 1]);
  }, 15_000);
});

describe('R2 — seat change inside the start window aborts cleanly', () => {
  it('lobby leave mid-start: ILLEGAL_MOVE abort, room intact, restart works', async () => {
    const env = new TestEnv({ matchConfig: FAST_MATCH_CONFIG, timing: FAST_TIMING });
    const { code, sockets } = await bootMatch(env, 2, { start: false, drivers: false });
    const host = sockets[0]!;
    const gate = gateProfiles(env);

    const tap = host.client('game:start', {});
    const parked = await waitFor(() => gate.loads() >= 1, 3_000, 2);
    expect(parked).toBe(true);

    // Seat 1's user leaves the lobby WHILE the start is parked on profiles.
    const leaveRes = await env.manager.leaveSocket(sockets[1]!.id, 'u1');
    expect(leaveRes.ok).toBe(true);

    gate.release();
    const res = await tap;
    expect(res?.ok).toBe(false);
    expect((res?.error as { code: string }).code).toBe('ILLEGAL_MOVE');

    const room = env.manager.roomByCode(code)!;
    expect(room.match).toBeNull(); // no half-started runtime, mappings rolled back
    const phase = (host.last('lobby:state') as { phase: string }).phase;
    expect(phase).toBe('lobby');

    // The room is still playable: re-seat the user, start again, deal once.
    const rejoined = await joinRoom(env, env.socket(env.user('u1')), code);
    expect(rejoined.yourSeat).toBe(1);
    const restart = await host.client('game:start', {});
    expect(restart?.ok).toBe(true);
    const started = await waitFor(() => host.received('round:new').length === 1, 3_000, 2);
    expect(started).toBe(true);
    expect(host.received('hand:deal').length).toBe(1);
  }, 15_000);
});

describe('R3 — kickoff grace clocks are anchored to the ENGINE deadline', () => {
  it('seat dropped pre-start: grace slot re-anchored at kickoff, ABANDON lands', async () => {
    const env = new TestEnv({ matchConfig: FAST_MATCH_CONFIG, timing: FAST_TIMING });
    const { code, sockets } = await bootMatch(env, 3, { start: false, drivers: false });
    const graceMs = FAST_MATCH_CONFIG.disconnectGraceMs;

    // Drop seat 1 BEFORE the start → a lobby-era grace slot arms at t0+grace.
    sockets[1]!.disconnect();
    const slotBefore = env.manager.roomByCode(code)!.wheel.deadlineOf('grace:u1');
    expect(slotBefore).toBeDefined();
    await new Promise((r) => setTimeout(r, 30)); // ensure the two epochs differ

    const startRes = await env.manager.startMatch('u0');
    expect(startRes.ok).toBe(true);

    const room = env.manager.roomByCode(code)!;
    const p1 = room.match!.engineState.players.find((p) => p.seat === 1)!;
    expect(p1.disconnectedAt).toBeDefined(); // kickoff DISCONNECT applied

    // Fixed behavior: the slot follows the ENGINE clock (kickoff + grace),
    // strictly past the stale lobby-era slot.
    expect(room.wheel.deadlineOf('grace:u1')).toBe(p1.disconnectedAt! + graceMs);
    expect(room.wheel.deadlineOf('grace:u1')!).toBeGreaterThan(slotBefore!);

    const abandoned = await waitFor(
      () => room.match!.engineState.players.find((p) => p.seat === 1)!.abandoned === true,
      4_000,
      10,
    );
    expect(abandoned).toBe(true); // seat lost — not silently disconnected forever
    expect(room.match!.isOver).toBe(false); // 2 of 3 still present → match runs on
  }, 15_000);
});

describe('R4 — rooms vacated by a socket rebind are reaped', () => {
  it('double room:create: the FIRST room idle-GCs away, the second survives', async () => {
    const env = new TestEnv({ timing: { ...FAST_TIMING, idleGcMs: 50 } });
    const host = env.socket(env.user('h'));

    const tapA = host.client('room:create', {
      name: 'First',
      capacity: 2,
      theme: 'saloon',
      visibility: 'public',
    });
    const tapB = host.client('room:create', {
      name: 'Second',
      capacity: 2,
      theme: 'saloon',
      visibility: 'public',
    });
    const [a, b] = await Promise.all([tapA, tapB]);
    expect(a?.ok).toBe(true);
    expect(b?.ok).toBe(true);
    const codeA = (a?.data as { roomCode: string }).roomCode;
    const codeB = (b?.data as { roomCode: string }).roomCode;
    expect(codeA).not.toBe(codeB);

    // The rebind vacated the first room — its idle sweep must now own it.
    const reaped = await waitFor(() => env.manager.roomByCode(codeA) === null, 3_000, 10);
    expect(reaped).toBe(true);
    expect(env.manager.roomByCode(codeB)).not.toBeNull();
    expect(env.store.removed).toContain(codeA);
    expect(env.store.removed).not.toContain(codeB);
    expect(env.manager.roomCount).toBe(1);
  }, 8_000);
});

describe('R6 — host cascade: a room can never become permanently hostless', () => {
  it('grace cascade empties every seat → the first fresh sitter claims host', async () => {
    const env = new TestEnv({ matchConfig: FAST_MATCH_CONFIG, timing: FAST_TIMING });
    const alice = env.socket(env.user('alice'));
    const code = await createRoom(env, alice, { capacity: 2, visibility: 'private' });
    const bob = env.socket(env.user('bob'));
    await joinRoom(env, bob, code);
    const sam = env.socket(env.user('sam'));
    await joinRoom(env, sam, code); // spectator keeps the room alive

    // Both seated humans drop. The grace slots fire in scheduling order —
    // the host's first — so promotion passes through the doomed bob and the
    // room ends up pointing at a departed host with every seat empty.
    alice.disconnect();
    env.detach(alice);
    bob.disconnect();
    env.detach(bob);
    const emptied = await waitFor(
      () => env.manager.roomByCode(code)!.seatsTaken() === 0,
      4_000,
      5,
    );
    expect(emptied).toBe(true);

    // The returning human is seated FRESH and self-heals hostship; before
    // the fix the room kept dead bob as host → NOT_HOST forever.
    const alice2 = env.socket(env.user('alice'));
    const rejoin = await joinRoom(env, alice2, code);
    expect(rejoin.reconnected).toBe(false);
    const start = await alice2.client('game:start', {});
    expect((start?.error as { code: string }).code).toBe('INSUFFICIENT_PLAYERS');

    // A second human seats → the match starts; the spectator stays outside.
    const dana = env.socket(env.user('dana'));
    await joinRoom(env, dana, code);
    const go = await alice2.client('game:start', {});
    expect(go?.ok).toBe(true);
    const hands = await waitFor(
      () => alice2.received('hand:deal').length > 0 && dana.received('hand:deal').length > 0,
      5_000,
      5,
    );
    expect(hands).toBe(true);
    expect(sam.received('hand:deal')).toHaveLength(0);
  }, 20_000);
});

describe('R5 — onMatchEnd seam isolation (sync throw ≠ process death)', () => {
  it('handleMatchEnd swallows a synchronous throw; listeners still fire', async () => {
    const env = new TestEnv({
      onMatchEnd: () => {
        throw new Error('grantMatchRewards exploded before its first await');
      },
    });
    const seen: number[] = [];
    env.manager.addMatchEndListener((p) => seen.push(p.record.capacity));

    const payload: MatchEndPayload = {
      record: abortedRecord(),
      roomCode: 'ZZZZZ',
      seed: 1,
      log: [],
      endedAt: new Date(),
    };
    expect(() => env.manager.handleMatchEnd(payload)).not.toThrow();
    expect(seen).toEqual([2]);
  });

  it('full flow: a mid-process seam throw never eats the game:over broadcast', async () => {
    const env = new TestEnv({
      matchConfig: FAST_MATCH_CONFIG,
      timing: FAST_TIMING,
      onMatchEnd: () => {
        throw new Error('boom');
      },
    });
    const { code, sockets } = await bootMatch(env, 2, { start: true, drivers: false });
    const seat = await waitForHandsAndTurn(env, sockets);
    const survivor = sockets[seat === 0 ? 1 : 0]!;
    sockets[seat]!.disconnect();

    const over = await waitFor(() => survivor.received('game:over').length >= 1, 6_000, 10);
    expect(over).toBe(true);
    expect(env.manager.roomByCode(code)!.match!.isOver).toBe(true);
  }, 20_000);
});
