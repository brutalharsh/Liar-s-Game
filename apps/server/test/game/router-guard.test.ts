/**
 * Crash containment tests (STR/10 P0 follow-up — A4): NO exception escaping a
 * router handler may reach unhandled-rejection territory — the exact class
 * that killed the process mid-ack during the game:start smoke. For every
 * client event, a stub manager is forced to throw (sync) or reject (async) at
 * each seam; the guard must answer with:
 *   1. ack {ok:false, error:{code:'INTERNAL',…}} — user-safe text only
 *      (the raw message/stack never crosses the wire),
 *   2. an `error` event on the offending socket (code + eventRef),
 *   3. a console.error carrying the event name + the real stack, and
 *   4. a RESOLVED handler promise (captured via a FakeSocket subclass — a
 *      rejection here is precisely the old unhandled-rejection death).
 * Ordering cases prove containment never re-orders requireUser/parse. No
 * process-level handlers anywhere — this is scoped containment, not
 * swallowing: every crash is logged and answered, just never fatal.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Server } from 'socket.io';
import { attachGameRouter } from '../../src/game/router.js';
import type {
  ActionResult,
  CreateOutcome,
  JoinOutcome,
  ManagerDeps,
  RoomManager,
} from '../../src/game/rooms.js';
import {
  DEFAULT_GAME_TIMING,
  type GameSocket,
  type RoomTransport,
} from '../../src/game/types.js';
import type { SessionUser } from '../../src/middleware/auth.js';
import { createTransport, FakeIo, FakeSocket } from './helpers.js';

type CrashMode = 'sync' | 'async';

/** Which seam (manager method or auth) a scenario forces to crash. */
interface ManagerSpec {
  auth?: 'ok' | 'none' | 'crash';
  emitError?: CrashMode;
  roomOfSocket?: CrashMode;
  createRoom?: CrashMode;
  joinRoom?: CrashMode;
  leaveSocket?: CrashMode;
  startMatch?: CrashMode;
  playCards?: CrashMode;
  callLiar?: CrashMode;
  sendEmote?: CrashMode;
  ttsSay?: CrashMode;
  socketDisconnected?: CrashMode;
}

const BOOM_SUFFIX = '-boom';

function boom(name: string): Error {
  return new Error(`${name}${BOOM_SUFFIX}`);
}

const USER: SessionUser = { id: 'u1', nickname: 'Nick-u1', level: 3, banned: false };

const CREATE = { name: 'Saloon', capacity: 2, theme: 'saloon', visibility: 'private' };

/**
 * FakeSocket that captures the promise every registered handler returns —
 * the containment probe: a REJECTED handler promise is exactly the
 * unhandled rejection that used to kill the process (Socket.IO ignores
 * listener return values, so surfacing the promise for tests is free).
 */
class GuardSocket extends FakeSocket {
  readonly handlerPromises: Promise<unknown>[] = [];

  override on(event: string, cb: (payload?: unknown, ack?: unknown) => void): void {
    super.on(event, (payload?: unknown, ack?: unknown): void => {
      const returned = (cb as (payload?: unknown, ack?: unknown) => unknown)(payload, ack);
      if (returned instanceof Promise) this.handlerPromises.push(returned);
    });
  }
}

/** Core containment assertion: ≥1 handler promise fired and every one RESOLVED. */
async function expectHandlerPromisesResolve(socket: GuardSocket): Promise<void> {
  expect(socket.handlerPromises.length).toBeGreaterThan(0);
  const settled = await Promise.allSettled(socket.handlerPromises);
  const reasons = settled
    .filter((r): r is PromiseRejectedResult => r.status === 'rejected')
    .map((r) => (r.reason instanceof Error ? r.reason.message : String(r.reason)));
  expect(reasons, `rejected handler promise(s): ${reasons.join(' | ')}`).toEqual([]);
}

/**
 * Stub RoomManager covering only the router-consumed surface; each seam can
 * be told to throw synchronously or reject asynchronously. `emitError`
 * mirrors the real seam (routes the `error` event through the transport).
 */
function makeManager(transport: RoomTransport, spec: ManagerSpec): RoomManager {
  const goodCreate: ActionResult<CreateOutcome> = { ok: true, data: { roomCode: 'AAAAA', seat: 0 } };
  const goodJoin: ActionResult<JoinOutcome> = {
    ok: true,
    data: { roomCode: 'AAAAA', spectator: false, yourSeat: 1, reconnected: false },
  };
  const manager = {
    emitError(socketId: string, code: string, message: string, eventRef: string): void {
      if (spec.emitError === 'sync') throw boom('emitError-sync');
      transport.emitToSocket(socketId, 'error', { seq: 0, code, message, eventRef });
    },
    roomOfSocket(_socketId: string): null {
      if (spec.roomOfSocket === 'sync') throw boom('roomOfSocket-sync');
      return null;
    },
    // Deliberately NOT async functions: 'sync' mode throws at the call site
    // inside the handler body (a non-async manager seam misbehaving).
    createRoom(_input: unknown): Promise<ActionResult<CreateOutcome>> {
      if (spec.createRoom === 'sync') throw boom('createRoom-sync');
      if (spec.createRoom === 'async') return Promise.reject(boom('createRoom-async'));
      return Promise.resolve(goodCreate);
    },
    joinRoom(_input: unknown): Promise<ActionResult<JoinOutcome>> {
      if (spec.joinRoom === 'sync') throw boom('joinRoom-sync');
      if (spec.joinRoom === 'async') return Promise.reject(boom('joinRoom-async'));
      return Promise.resolve(goodJoin);
    },
    leaveSocket(_socketId: string, _userId: string): ActionResult<null> {
      if (spec.leaveSocket === 'sync') throw boom('leaveSocket-sync');
      return { ok: true, data: null };
    },
    startMatch(_userId: string): Promise<ActionResult<{ started: boolean }>> {
      if (spec.startMatch === 'sync') throw boom('startMatch-sync');
      if (spec.startMatch === 'async') return Promise.reject(boom('startMatch-async'));
      return Promise.resolve({ ok: true, data: { started: true } });
    },
    playCards(_socketId: string, _cardIds: string[]): ActionResult<{ seq: number }> {
      if (spec.playCards === 'sync') throw boom('playCards-sync');
      return { ok: true, data: { seq: 42 } };
    },
    callLiar(_socketId: string, _accusedSeat: number): ActionResult<{ seq: number }> {
      if (spec.callLiar === 'sync') throw boom('callLiar-sync');
      return { ok: true, data: { seq: 42 } };
    },
    sendEmote(_socketId: string, _emoteId: string): ActionResult<null> {
      if (spec.sendEmote === 'sync') throw boom('sendEmote-sync');
      return { ok: true, data: null };
    },
    ttsSay(_socketId: string, _phraseId: string): ActionResult<null> {
      if (spec.ttsSay === 'sync') throw boom('ttsSay-sync');
      return { ok: true, data: null };
    },
    socketDisconnected(_socketId: string): void {
      if (spec.socketDisconnected === 'sync') throw boom('socketDisconnected-sync');
    },
  };
  return manager as unknown as RoomManager;
}

function makeDeps(transport: RoomTransport, spec: ManagerSpec): ManagerDeps {
  const deps = {
    transport,
    authenticateSocket: async (_socket: GameSocket): Promise<SessionUser | null> => {
      // async fn → 'crash' mode is a rejected promise, the P0 shape.
      if (spec.auth === 'crash') throw boom('authenticateSocket-async');
      return spec.auth === 'none' ? null : USER;
    },
    sanitizeEmote: (raw: string) => raw,
    randomInt: (minInclusive: number) => minInclusive,
    randomUuid: () => 'test-mid',
    now: () => 0,
    userProfile: async (_accountId: string) => null,
    hasEntitlement: async () => false,
    publicRoomStore: { upsert: async () => undefined, remove: async () => undefined },
    joinRateLimit: null,
    matchConfig: {},
    onMatchEnd: (_payload: unknown) => undefined,
    timing: { ...DEFAULT_GAME_TIMING },
  };
  return deps as unknown as ManagerDeps;
}

/** Router bound to a stub manager + one connected capture socket. */
function setup(spec: ManagerSpec = {}): { io: FakeIo; socket: GuardSocket } {
  const io = new FakeIo();
  const transport = createTransport(io);
  const manager = makeManager(transport, spec);
  attachGameRouter(io as unknown as Server, manager, makeDeps(transport, spec));
  const socket = new GuardSocket('sock-1', '10.0.0.9');
  io.connect(socket);
  return { io, socket };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('crash containment (STR/10 P0 follow-up: no handler exception is fatal)', () => {
  const CRASH_CASES: Array<{
    label: string;
    event: string;
    payload: unknown;
    spec: ManagerSpec;
    marker: string;
  }> = [
    { label: 'room:create survives a synchronous createRoom throw', event: 'room:create', payload: CREATE, spec: { createRoom: 'sync' }, marker: 'createRoom-sync-boom' },
    { label: 'room:create survives a createRoom promise rejection', event: 'room:create', payload: CREATE, spec: { createRoom: 'async' }, marker: 'createRoom-async-boom' },
    { label: 'room:create survives a post-success roomOfSocket throw', event: 'room:create', payload: CREATE, spec: { roomOfSocket: 'sync' }, marker: 'roomOfSocket-sync-boom' },
    { label: 'room:join survives a synchronous joinRoom throw', event: 'room:join', payload: { code: 'AAAAA' }, spec: { joinRoom: 'sync' }, marker: 'joinRoom-sync-boom' },
    { label: 'room:join survives a joinRoom promise rejection', event: 'room:join', payload: { code: 'AAAAA' }, spec: { joinRoom: 'async' }, marker: 'joinRoom-async-boom' },
    { label: 'room:leave survives a leaveSocket throw', event: 'room:leave', payload: {}, spec: { leaveSocket: 'sync' }, marker: 'leaveSocket-sync-boom' },
    { label: 'game:start survives a synchronous startMatch throw', event: 'game:start', payload: {}, spec: { startMatch: 'sync' }, marker: 'startMatch-sync-boom' },
    { label: 'game:start survives a startMatch promise rejection', event: 'game:start', payload: {}, spec: { startMatch: 'async' }, marker: 'startMatch-async-boom' },
    { label: 'play:cards survives a playCards throw', event: 'play:cards', payload: { cardIds: ['K1'] }, spec: { playCards: 'sync' }, marker: 'playCards-sync-boom' },
    { label: 'liar:call survives a callLiar throw', event: 'liar:call', payload: { accusedSeat: 0 }, spec: { callLiar: 'sync' }, marker: 'callLiar-sync-boom' },
    { label: 'emote:send survives a sendEmote throw', event: 'emote:send', payload: { emoteId: 'laugh' }, spec: { sendEmote: 'sync' }, marker: 'sendEmote-sync-boom' },
    { label: 'profile:tts-say survives a ttsSay throw', event: 'profile:tts-say', payload: { phraseId: 'liar' }, spec: { ttsSay: 'sync' }, marker: 'ttsSay-sync-boom' },
  ];

  for (const c of CRASH_CASES) {
    it(c.label, async () => {
      const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const { socket } = setup(c.spec);
      const res = await socket.client(c.event, c.payload);
      // 1. standard error ack — INTERNAL, user-safe text only
      expect(res?.ok).toBe(false);
      expect(res?.error?.code).toBe('INTERNAL');
      expect(res?.error?.message ?? '').not.toMatch(/boom|[\\[{]/);
      // 2. `error` event names the offending event
      const errors = socket.received('error');
      expect(errors).toHaveLength(1);
      expect(errors[0]!['code']).toBe('INTERNAL');
      expect(errors[0]!['eventRef']).toBe(c.event);
      expect(String(errors[0]!['message'])).not.toMatch(/boom/);
      // 3. server-side log carries the event name + the real stack
      expect(errSpy).toHaveBeenCalledWith(
        expect.stringContaining(`"${c.event}"`),
        expect.stringContaining(c.marker),
      );
      // 4. the handler promise RESOLVES — its rejection was the P0 crash
      await expectHandlerPromisesResolve(socket);
    });
  }

  it('an authenticateSocket rejection becomes INTERNAL on every event (cached rejection included)', async () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { socket } = setup({ auth: 'crash' });
    const first = await socket.client('play:cards', { cardIds: ['K1'] });
    expect(first?.ok).toBe(false);
    expect(first?.error?.code).toBe('INTERNAL');
    // Second event reuses the CACHED rejected lookup — still contained.
    const second = await socket.client('liar:call', { accusedSeat: 0 });
    expect(second?.ok).toBe(false);
    expect(second?.error?.code).toBe('INTERNAL');
    expect(socket.received('error')).toHaveLength(2);
    const stackArg = expect.stringContaining(`authenticateSocket-async${BOOM_SUFFIX}`);
    expect(errSpy).toHaveBeenCalledWith(expect.stringContaining('"play:cards"'), stackArg);
    expect(errSpy).toHaveBeenCalledWith(expect.stringContaining('"liar:call"'), stackArg);
    await expectHandlerPromisesResolve(socket);
  });

  it('a broken reject path stays contained (emitError throws) and still acks INTERNAL', async () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { socket } = setup({ playCards: 'sync', emitError: 'sync' });
    const res = await socket.client('play:cards', { cardIds: ['K1'] });
    expect(res?.ok).toBe(false);
    expect(res?.error?.code).toBe('INTERNAL'); // ack fallback fired
    expect(socket.received('error')).toHaveLength(0); // error event died with the transport
    expect(errSpy).toHaveBeenCalledTimes(2); // handler crash + reject-path crash
    expect(errSpy).toHaveBeenCalledWith(
      expect.stringContaining('reject path for "play:cards"'),
      expect.stringContaining(`emitError-sync${BOOM_SUFFIX}`),
    );
    await expectHandlerPromisesResolve(socket);
  });

  it('a socketDisconnected throw cannot escape the disconnect handler (no ack channel)', async () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { socket } = setup({ socketDisconnected: 'sync' });
    expect(() => socket.disconnect()).not.toThrow();
    await expectHandlerPromisesResolve(socket);
    expect(errSpy).toHaveBeenCalledWith(
      expect.stringContaining('"disconnect"'),
      expect.stringContaining(`socketDisconnected-sync${BOOM_SUFFIX}`),
    );
  });

  it('contains a crash while binding a freshly connected socket (deep guard)', () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const io = new FakeIo();
    const transport = createTransport(io);
    attachGameRouter(io as unknown as Server, makeManager(transport, {}), makeDeps(transport, {}));
    const poisoned = {
      id: 'poison',
      on(): void {
        throw boom('bind-sync');
      },
    };
    expect(() => io.connect(poisoned as unknown as FakeSocket)).not.toThrow();
    expect(errSpy).toHaveBeenCalledWith(
      expect.stringContaining('connection listener'),
      expect.stringContaining(`bind-sync${BOOM_SUFFIX}`),
    );
  });
});

describe('guard ordering: containment never re-orders the S1 dispatch chain', () => {
  const EVERY_SEAM_CRASHES: ManagerSpec = {
    createRoom: 'sync',
    joinRoom: 'sync',
    leaveSocket: 'sync',
    startMatch: 'sync',
    playCards: 'sync',
    callLiar: 'sync',
    sendEmote: 'sync',
    ttsSay: 'sync',
    roomOfSocket: 'sync',
  };

  it('anonymous sockets bounce AUTH_REQUIRED before any manager seam is touched', async () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { socket } = setup({ ...EVERY_SEAM_CRASHES, auth: 'none' });
    const valid: Array<[string, unknown]> = [
      ['room:create', CREATE],
      ['room:join', { code: 'AAAAA' }],
      ['room:leave', {}],
      ['game:start', {}],
      ['play:cards', { cardIds: ['K1'] }],
      ['liar:call', { accusedSeat: 0 }],
      ['emote:send', { emoteId: 'laugh' }],
      ['profile:tts-say', { phraseId: 'liar' }],
    ];
    for (const [event, payload] of valid) {
      const res = await socket.client(event, payload);
      expect(res?.error?.code, event).toBe('AUTH_REQUIRED');
    }
    expect(errSpy).not.toHaveBeenCalled(); // nothing crashed: the manager was never reached
    await expectHandlerPromisesResolve(socket);
  });

  it('junk payloads bounce VALIDATION before any manager seam is touched', async () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { socket } = setup(EVERY_SEAM_CRASHES);
    const junk: Array<[string, unknown]> = [
      ['room:create', { name: '', capacity: 2, theme: 'saloon', visibility: 'private' }],
      ['room:join', { code: 'abc' }],
      ['room:leave', { extra: 1 }],
      ['game:start', { extra: 1 }],
      ['play:cards', { cardIds: [] }],
      ['liar:call', { accusedSeat: 99 }],
      ['emote:send', { emoteId: '' }],
      ['profile:tts-say', { phraseId: 'x'.repeat(33) }],
    ];
    for (const [event, payload] of junk) {
      const res = await socket.client(event, payload);
      expect(res?.error?.code, event).toBe('VALIDATION');
    }
    expect(errSpy).not.toHaveBeenCalled();
    await expectHandlerPromisesResolve(socket);
  });
});

describe('happy-path regression: containment changed zero happy behavior', () => {
  it('all 8 events ack exactly as before under a healthy manager', async () => {
    const { socket } = setup();
    const create = await socket.client('room:create', CREATE);
    expect(create?.ok).toBe(true);
    expect(create?.data).toEqual({ roomCode: 'AAAAA' });
    const join = await socket.client('room:join', { code: 'AAAAA' });
    expect(join?.ok).toBe(true);
    expect(join?.data).toEqual({ roomCode: 'AAAAA', spectator: false, yourSeat: 1, reconnected: false });
    const leave = await socket.client('room:leave', {});
    expect(leave?.ok).toBe(true);
    expect(leave?.data).toBeNull();
    const start = await socket.client('game:start', {});
    expect(start?.ok).toBe(true);
    expect(start?.data).toBeNull();
    const play = await socket.client('play:cards', { cardIds: ['K1'] });
    expect(play?.ok).toBe(true);
    expect(play?.data).toEqual({ seq: 42 });
    const liar = await socket.client('liar:call', { accusedSeat: 0 });
    expect(liar?.ok).toBe(true);
    expect(liar?.data).toEqual({ seq: 42 });
    const emote = await socket.client('emote:send', { emoteId: 'laugh' });
    expect(emote?.ok).toBe(true);
    expect(emote?.data).toBeNull();
    const tts = await socket.client('profile:tts-say', { phraseId: 'liar' });
    expect(tts?.ok).toBe(true);
    expect(tts?.data).toBeNull();
    expect(socket.received('error')).toHaveLength(0);
    expect(socket.handlerPromises.length).toBe(8);
    await expectHandlerPromisesResolve(socket);
  });
});
