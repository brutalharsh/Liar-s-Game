/**
 * Game-layer test harness — in-process fake io/sockets/transport plus
 * deterministic env wiring. NO socket.io-client, NO network, NO Mongo:
 * deps inject an in-memory public-rooms store, a sequential crypto-port
 * stub, and per-socket session resolution.
 *
 * The fake transport doubles as the CI privacy tripwire's capture point:
 * every emission a "client" would receive lands in that socket's
 * `emissions` log with the exact payload the server serialized.
 */
import type { Server } from 'socket.io';
import { sanitizeDisplayName } from '@liars-game/shared';
import { attachGameRouter } from '../../src/game/router.js';
import { RoomManager, type ManagerDeps } from '../../src/game/rooms.js';
import {
  DEFAULT_GAME_TIMING,
  type GameTiming,
  type MatchEndPayload,
  type OnMatchEnd,
  type PublicRoomDoc,
  type PublicRoomStore,
  type RoomTransport,
} from '../../src/game/types.js';
import type { SessionUser } from '../../src/middleware/auth.js';

// ─────────────────────────────────────────────────────────────────────────────
// Fake sockets + io
// ─────────────────────────────────────────────────────────────────────────────

export interface FakeEmission {
  event: string;
  payload: Record<string, unknown>;
}

export interface AckResultCaptured {
  ok: boolean;
  data?: unknown;
  error?: { code: string; message: string };
}

export class FakeSocket {
  readonly data: Record<string, unknown> = {};
  readonly rooms = new Set<string>();
  readonly emissions: FakeEmission[] = [];
  readonly handshake: { address: string };
  private readonly handlers = new Map<string, Array<(payload?: unknown, ack?: unknown) => void>>();
  private readonly watchers: Array<(e: FakeEmission) => void> = [];
  private nextId = 0;

  constructor(
    readonly id: string,
    address: string,
  ) {
    this.handshake = { address };
  }

  on(event: string, cb: (payload?: unknown, ack?: unknown) => void): void {
    const list = this.handlers.get(event) ?? [];
    list.push(cb);
    this.handlers.set(event, list);
  }

  /** Fires transport-level emissions into this socket's capture log. */
  receive(event: string, payload: Record<string, unknown>): void {
    const emission: FakeEmission = { event, payload };
    this.emissions.push(emission);
    for (const w of [...this.watchers]) {
      try {
        w(emission);
      } catch {
        /* watcher bugs must not break transport */
      }
    }
  }

  watch(fn: (e: FakeEmission) => void): () => void {
    this.watchers.push(fn);
    return () => {
      const i = this.watchers.indexOf(fn);
      if (i >= 0) this.watchers.splice(i, 1);
    };
  }

  emitTransport(event: string, payload: Record<string, unknown>): void {
    this.receive(event, payload);
  }

  /** Client → server: invoke this socket's handlers for `event`, await one ack. */
  async client(event: string, payload?: unknown): Promise<AckResultCaptured | null> {
    const handlers = this.handlers.get(event) ?? [];
    if (handlers.length === 0) throw new Error(`fake socket has no handler for "${event}"`);
    let ackResolve: ((r: AckResultCaptured) => void) | null = null;
    const ackPromise = new Promise<AckResultCaptured>((resolve) => {
      ackResolve = resolve;
    });
    const ack = (result: AckResultCaptured): void => {
      ackResolve?.(result);
    };
    for (const h of handlers) {
      h(payload, ack as unknown);
    }
    const timeout = new Promise<null>((resolve) => {
      setTimeout(() => resolve(null), 2_000).unref?.();
    });
    return Promise.race([ackPromise, timeout]);
  }

  /** Fires the transport disconnect (network drop). */
  disconnect(): void {
    for (const cb of this.handlers.get('disconnect') ?? []) {
      cb();
    }
  }

  /** All captured payloads for one event name. */
  received(event: string): Record<string, unknown>[] {
    return this.emissions.filter((e) => e.event === event).map((e) => e.payload);
  }

  last(event: string): Record<string, unknown> | undefined {
    const all = this.received(event);
    return all.length > 0 ? all[all.length -  1] : undefined;
  }
}

export class FakeIo {
  readonly sockets = new Map<string, FakeSocket>();
  private connectionListeners: Array<(socket: FakeSocket) => void> = [];

  connect(socket: FakeSocket): void {
    this.sockets.set(socket.id, socket);
    for (const cb of [...this.connectionListeners]) cb(socket);
  }

  dropSocket(socket: FakeSocket): void {
    this.sockets.delete(socket.id);
  }

  on(event: 'connection', cb: (socket: FakeSocket) => void): void {
    if (event !== 'connection') throw new Error('fake io only supports "connection"');
    this.connectionListeners.push(cb);
  }

  off(_event: 'connection', cb: (socket: FakeSocket) => void): void {
    this.connectionListeners = this.connectionListeners.filter((c) => c !== cb);
  }
}

export function createTransport(io: FakeIo): RoomTransport {
  return {
    join(socketId, roomCode): void {
      io.sockets.get(socketId)?.rooms.add(roomCode);
    },
    leave(socketId, roomCode): void {
      io.sockets.get(socketId)?.rooms.delete(roomCode);
    },
    emitToRoom(roomCode, event, payload): void {
      for (const socket of io.sockets.values()) {
        if (socket.rooms.has(roomCode)) socket.receive(event, payload as Record<string, unknown>);
      }
    },
    emitToSocket(socketId, event, payload): void {
      io.sockets.get(socketId)?.receive(event, payload as Record<string, unknown>);
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Deterministic crypto port (sequential) + memory stores
// ─────────────────────────────────────────────────────────────────────────────

export class SeqRng {
  private counter = 0;

  /** Deterministic inclusive integer source — cycles within its range. */
  readonly int = (minInclusive: number, maxInclusive: number): number => {
    const range = Math.max(1, maxInclusive - minInclusive + 1);
    return minInclusive + (this.counter++ % range);
  };
}

export class MemoryPublicRoomStore implements PublicRoomStore {
  readonly docs = new Map<string, PublicRoomDoc>();
  readonly removed: string[] = [];

  async upsert(doc: PublicRoomDoc): Promise<void> {
    this.docs.set(doc.roomCode, { ...doc });
  }

  async remove(roomCode: string): Promise<void> {
    this.docs.delete(roomCode);
    this.removed.push(roomCode);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Test environment
// ─────────────────────────────────────────────────────────────────────────────

export interface TestUserSpec {
  id: string;
  nickname?: string;
}

export interface EnvOptions {
  users?: TestUserSpec[];
  capacity?: number;
  theme?: string;
  timing?: Partial<GameTiming>;
  matchConfig?: ManagerDeps['matchConfig'];
  hasEntitlement?: ManagerDeps['hasEntitlement'];
  onMatchEnd?: OnMatchEnd;
  joinRateLimit?: { windowMs: number; limit: number } | null;
}

export class TestEnv {
  readonly io = new FakeIo();
  readonly transport: RoomTransport;
  readonly manager: RoomManager;
  readonly deps: ManagerDeps;
  readonly store = new MemoryPublicRoomStore();
  readonly rng = new SeqRng();
  readonly matchEnds: MatchEndPayload[] = [];
  readonly authUsers = new Map<string, SessionUser | null>();
  private idc = 0;
  private uuidc = 0;

  constructor(opts: EnvOptions = {}) {
    this.transport = createTransport(this.io);
    const self = this;
    this.deps = {
      transport: this.transport,
      timing: { ...DEFAULT_GAME_TIMING, ...(opts.timing ?? {}) },
      authenticateSocket: async (socket) => {
        const user = self.authUsers.get(socket.id);
        return user ?? null;
      },
      sanitizeEmote: (raw) => sanitizeDisplayName(raw, { maxLength: 32 }),
      randomInt: this.rng.int,
      randomUuid: () => {
        self.uuidc += 1;
        return `match-${self.uuidc}`;
      },
      now: () => Date.now(),
      userProfile: async (accountId) => ({
        avatarSpec: { base: `starter-${accountId}` },
        activeTitle: `title-${accountId}`,
      }),
      hasEntitlement: opts.hasEntitlement ?? (async () => false),
      publicRoomStore: this.store,
      joinRateLimit: opts.joinRateLimit !== undefined ? opts.joinRateLimit : null,
      matchConfig: opts.matchConfig ?? {},
      onMatchEnd:
        opts.onMatchEnd ??
        ((payload) => {
          self.matchEnds.push(payload);
        }),
    };
    this.manager = new RoomManager(this.deps);
    attachGameRouter(this.io as unknown as Server, this.manager, this.deps);
  }

  user(id: string, nickname?: string): SessionUser {
    return { id, nickname: nickname ?? `Nick-${id}`, level: 3, banned: false };
  }

  socket(user: SessionUser | null, address?: string): FakeSocket {
    this.idc += 1;
    const s = new FakeSocket(`sock-${this.idc}`, address ?? `10.0.0.${this.idc % 250}`);
    if (this.io.sockets.has(s.id)) throw new Error('socket id collision');
    this.authUsers.set(s.id, user);
    this.io.connect(s);
    return s;
  }

  detach(socket: FakeSocket): void {
    this.io.dropSocket(socket);
    this.authUsers.delete(socket.id);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Fast match knobs + deterministic full-lifecycle driver
// ─────────────────────────────────────────────────────────────────────────────

export const FAST_TIMING: Partial<GameTiming> = {
  dealStaggerMs: 1,
  revealAckMs: 4,
  shotAckMs: 4,
  roundEndMs: 4,
  botThinkMinMs: 1,
  botThinkJitterMs: 2,
  idleGcMs: 60_000,
  emoteCooldownMs: 3_000,
};

export const FAST_MATCH_CONFIG = {
  turnTimerMsOverride: 400,
  armDelayMs: 5,
  windowMs: 500,
  disconnectGraceMs: 250,
};

export interface WireCardView {
  id: string;
  rank: string;
}

export interface AutoPlayer {
  socket: FakeSocket;
  userId: string;
  seat: number | null;
  hand: WireCardView[];
  firstPlayOfRound: boolean;
  lastPlayedSeat: number | null;
  actedRounds: number;
  stop(): void;
}

function defer(fn: () => void, ms = 0): void {
  setTimeout(fn, ms).unref?.();
}

/**
 * Deterministic client policy driving a full match from OUTSIDE the server:
 *  - first turn of a round → PLAY one card;
 *  - every later turn      → LIAR on the last play (challenge+roulette ≈20ms)
 *  - ERR_WINDOW_NOT_ARMED  → retry once after the arm delay;
 *  - ERR_WINDOW_CLOSED     → fall back to a play.
 * All input comes ONLY from the socket's own captured emissions (hand:deal
 * to itself, play:accept counts) — the driver can't peek, same as a cheat
 * client would try to.
 */
export function installAutoPlayer(env: TestEnv, socket: FakeSocket, userId: string): AutoPlayer {
  const player: AutoPlayer = {
    socket,
    userId,
    seat: null,
    hand: [],
    firstPlayOfRound: true,
    lastPlayedSeat: null,
    actedRounds: 0,
    stop(): void {
      unwatch();
      stopped = true;
    },
  };
  let stopped = false;
  const callLiar = (accusedSeat: number, attempt = 0): void => {
    if (stopped) return;
    defer(async () => {
      if (stopped) return;
      const res = await socket.client('liar:call', { accusedSeat });
      const error = res && !res.ok ? res.error : undefined;
      if (error && error.code === 'ERR_WINDOW_NOT_ARMED' && attempt < 3) {
        callLiar(accusedSeat, attempt + 1);
      } else if (error && (error.code === 'ERR_WINDOW_CLOSED' || error.code === 'ERR_WRONG_ACCUSED')) {
        playOne();
      }
    }, attempt === 0 ? 0 : 12);
  };
  const playOne = (): void => {
    if (stopped || player.hand.length === 0) return;
    const cardId = player.hand[0]!.id;
    defer(async () => {
      if (stopped) return;
      await socket.client('play:cards', { cardIds: [cardId] });
    });
  };
  const unwatch = socket.watch((e) => {
    if (stopped) return;
    const seat = typeof e.payload['seat'] === 'number' ? e.payload['seat'] : null;
    switch (e.event) {
      case 'hand:deal':
        player.hand = e.payload['cards'] as WireCardView[];
        break;
      case 'round:new':
        player.firstPlayOfRound = true;
        break;
      case 'play:accept':
        player.lastPlayedSeat = seat;
        if (seat === player.seat) {
          player.hand = player.hand.slice((e.payload['count'] as number) ?? 1);
        }
        break;
      case 'turn:begin':
        if (seat === null || seat !== player.seat) return;
        if (player.firstPlayOfRound) {
          player.firstPlayOfRound = false;
          playOne();
        } else if (player.lastPlayedSeat !== null) {
          callLiar(player.lastPlayedSeat);
        }
        break;
      default:
        break;
    }
  });
  return player;
}

/** Waits until `check` passes or the timeout elapses (ms). */
export async function waitFor(
  check: () => boolean,
  ms = 5_000,
  stepMs = 5,
): Promise<boolean> {
  const deadline = Date.now() + ms;
  while (Date.now() < deadline) {
    if (check()) return true;
    await new Promise((resolve) => setTimeout(resolve, stepMs).unref?.());
  }
  return check();
}

let roomNameCounter = 0;

export async function createRoom(
  env: TestEnv,
  socket: FakeSocket,
  o: { name?: string; capacity?: number; theme?: string; visibility?: 'public' | 'private' } = {},
): Promise<string> {
  roomNameCounter += 1;
  const res = await socket.client('room:create', {
    name: o.name ?? `Room ${roomNameCounter}`,
    capacity: o.capacity ?? 2,
    theme: o.theme ?? 'saloon',
    visibility: o.visibility ?? 'private',
  });
  if (!res || !res.ok) throw new Error(`create failed: ${JSON.stringify(res?.error)}`);
  return (res.data as { roomCode: string }).roomCode;
}

export async function joinRoom(
  env: TestEnv,
  socket: FakeSocket,
  code: string,
): Promise<{ spectator: boolean; yourSeat: number | null; reconnected: boolean }> {
  const res = await socket.client('room:join', { code });
  if (!res || !res.ok) throw new Error(`join failed: ${JSON.stringify(res?.error)}`);
  return res.data as { spectator: boolean; yourSeat: number | null; reconnected: boolean };
}

/** Waits until every socket has a hand + the first turn:begin, returns its seat. */
export async function waitForHandsAndTurn(
  env: TestEnv,
  sockets: FakeSocket[],
): Promise<number> {
  const dealt = await waitFor(
    () =>
      sockets.every((s) => s.received('hand:deal').length > 0 && s.received('turn:begin').length > 0),
    5_000,
    2,
  );
  if (!dealt) throw new Error('hands and first turn never arrived');
  return sockets[0]!.last('turn:begin')!['seat'] as number;
}

/** Boots a room of N players (auto-drivers optional) and starts the match. */
export async function bootMatch(
  env: TestEnv,
  players: number,
  o: { start?: boolean; capacity?: number; drivers?: boolean } = {},
): Promise<{ code: string; sockets: FakeSocket[]; players: AutoPlayer[] }> {
  const sockets: FakeSocket[] = [];
  const auto: AutoPlayer[] = [];
  let code = '';
  for (let i = 0; i < players; i += 1) {
    const userId = `u${i}`;
    const socket = env.socket(env.user(userId), `10.1.0.${i + 1}`);
    sockets.push(socket);
    if (i === 0) {
      code = await createRoom(env, socket, {
        capacity: o.capacity ?? players,
        visibility: 'private',
      });
    } else {
      const ack = await joinRoom(env, socket, code);
      if (ack.spectator) throw new Error('unexpected spectator');
    }
    if (o.drivers !== false) {
      const p = installAutoPlayer(env, socket, userId);
      p.seat = i;
      auto.push(p);
    }
  }
  if (o.start !== false) {
    const res = await sockets[0]!.client('game:start', {});
    if (!res || !res.ok) throw new Error(`start failed: ${JSON.stringify(res?.error)}`);
  }
  return { code, sockets, players: auto };
}

/** Every socket's stream, mapped by user id — for privacy scans. */
export function emissionsPerUser(players: AutoPlayer[]): Map<string, FakeEmission[]> {
  const map = new Map<string, FakeEmission[]>();
  for (const p of players) map.set(p.userId, p.socket.emissions);
  return map;
}
