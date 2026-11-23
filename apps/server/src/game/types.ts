/**
 * S1 game-layer internal types — the only place game-specific shapes live
 * (src/models/** stays untouched; S1 consumes it read-only via deps).
 *
 * Wire payloads themselves come from `@liars-game/shared` (single source,
 * AGENTS.md rule 4); this file adds the SERVER-side runtime types only:
 * deps injection, room runtime, timer wheel config, and the match-end seam.
 */
import type { Socket } from 'socket.io';
import type { SessionUser } from '../middleware/auth.js';
import type { LogEntry, MatchConfig, MatchRecord as EngineMatchRecord } from '@liars-game/rules-engine';
import type { RoomVisibility } from '@liars-game/shared';

/** Socket as the game layer sees it: session user resolved into `data`. */
export type GameSocket = Socket & {
  data: { user?: SessionUser | null; authResolved?: Promise<SessionUser | null> };
};

/** Resolves the handshake cookie into a session user (null = anonymous). */
export type SocketAuthenticator = (socket: GameSocket) => Promise<SessionUser | null>;

// ─────────────────────────────────────────────────────────────────────────────
// MATCH END SEAM — exact contract; E1 implements the other side in parallel.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Handed out exactly once per match at `game:over`.
 *  - `record`: rules-engine `finishMatch` output (STR/09 stats core).
 *  - `seed` + `log`: the deterministic-replay pair (`replay({ roster, seed, events })`
 *    reproduces the match bit-for-bit — R1's persistence requirement).
 */
export interface MatchEndPayload {
  record: EngineMatchRecord;
  roomCode: string;
  seed: number;
  /** Rules-engine serialized log entries — rules-engine `LogEntry[]`. */
  log: LogEntry[];
  endedAt: Date;
}

/** Optional dependency of the game layer; `grantMatchRewards` (E1) lands here. */
// TODO-E1: wired at integration — index.ts will pass E1's grantMatchRewards.
export type OnMatchEnd = (payload: MatchEndPayload) => void | Promise<void>;

// ─────────────────────────────────────────────────────────────────────────────
// Injectable dependencies (tests stub every one; real wiring in ./index.ts)
// ─────────────────────────────────────────────────────────────────────────────

/** Entitlement lookup, e.g. Big Table: (accountId, 'capacity', 'big-table'). */
export type EntitlementChecker = (accountId: string, kind: string, key: string) => Promise<boolean>;

export interface MemberProfile {
  avatarSpec: unknown;
  activeTitle: string | null;
}

/** Loads echo fields (avatar/title) for the match record at game:start. */
export type UserProfileLoader = (accountId: string) => Promise<MemberProfile | null>;

/** Registry mirror row for the public rooms browser (STR/09 public_rooms). */
export interface PublicRoomDoc {
  roomCode: string;
  name: string;
  hostNickname: string;
  theme: string;
  capacity: number;
  seatsTaken: number;
  visibility: RoomVisibility;
}

/** Write-behind store behind the `public_rooms` Mongo collection (TTL 600s). */
export interface PublicRoomStore {
  upsert(doc: PublicRoomDoc): Promise<void>;
  remove(roomCode: string): Promise<void>;
}

/** `(min, max)` uniform integer, both inclusive — the injected crypto port. */
export type RandomInt = (minInclusive: number, maxInclusive: number) => number;

/** Cinematic + housekeeping pacing (STR/03 §5); tests shrink to ~ms. */
export interface GameTiming {
  /** round:new → BEGIN_TURNS (deal stagger). */
  dealStaggerMs: number;
  /** reveal:show/shot:assign → REVEAL_ACK (flips + verdict beat). */
  revealAckMs: number;
  /** shot:result → SHOT_ACK (cylinder + dead air + payoff ≈ 3.4s). */
  shotAckMs: number;
  /** round:end → NEXT_ROUND (banner). */
  roundEndMs: number;
  /** Empty-room dissolve sweep (STR/02: rooms auto-expire 10min idle). */
  idleGcMs: number;
  /** Emote relay cooldown (host-configurable knob, default 3s — STR/02). */
  emoteCooldownMs: number;
  /** Bot decision delay bounds. */
  botThinkMinMs: number;
  botThinkJitterMs: number;
}

export const DEFAULT_GAME_TIMING: Readonly<GameTiming> = Object.freeze({
  dealStaggerMs: 600,
  revealAckMs: 1_400,
  shotAckMs: 3_400,
  roundEndMs: 2_000,
  idleGcMs: 600_000,
  emoteCooldownMs: 3_000,
  botThinkMinMs: 1_200,
  botThinkJitterMs: 2_000,
});

/** Everything the game layer needs from the outside; only auth is required. */
export interface GameDeps {
  /** Session cookie → user, or null (play events then bounce AUTH_REQUIRED). */
  authenticateSocket: SocketAuthenticator;
  /** Match-end seam (E1). Absent in dev/tests until integration wires it. */
  onMatchEnd?: OnMatchEnd;
  /** Entitlement gate (Big Table capacity, premium themes). */
  hasEntitlement?: EntitlementChecker;
  /** Avatar/title echo loader for roster entries (game:start only — not hot). */
  userProfile?: UserProfileLoader;
  /** public_rooms registry mirror (write-behind, never blocks play). */
  publicRoomStore?: PublicRoomStore;
  /** Crypto integer source (room codes, seeds). Default: node:crypto. */
  randomInt?: RandomInt;
  /** Match-id source. Default: node:crypto randomUUID. */
  randomUuid?: () => string;
  /** Clock, injectable for tests. Default: Date.now. */
  now?: () => number;
  /** Cinematic pacing overrides. */
  timing?: Partial<GameTiming>;
  /** Engine config defaults applied to every match (tests shrink the timers). */
  matchConfig?: Partial<MatchConfig>;
  /** room:join attempt limiter per remote address (STR/07 §5). null disables. */
  joinRateLimit?: { windowMs: number; limit: number } | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Transport abstraction over Socket.IO (fake-socket tests inject their own)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Emission + membership seam. The real implementation wraps `io.to(...).emit`;
 * tests fake it so every payload a "client" receives is captured per socket —
 * the CI privacy tripwire's capture point.
 */
export interface RoomTransport {
  /** Bind a socket id to a room scope (Socket.IO `socket.join`). */
  join(socketId: string, roomCode: string): void;
  /** Unbind a socket id from a room scope. */
  leave(socketId: string, roomCode: string): void;
  /** Broadcast to every socket bound to the room scope (seated + spectators). */
  emitToRoom(roomCode: string, event: string, payload: unknown): void;
  /** Send to one socket id (room-code private emissions + errors). */
  emitToSocket(socketId: string, event: string, payload: unknown): void;
}

/** Stable error vocabulary used by the router (mirrors STR/07 §6 + engine codes). */
export const GAME_ERROR_CODES = Object.freeze({
  AUTH_REQUIRED: 'AUTH_REQUIRED', // STR/07 §0 name (shared's UNAUTHORIZED constant is unused here)
  VALIDATION: 'VALIDATION',
  NOT_IN_ROOM: 'NOT_IN_ROOM',
  NOT_HOST: 'NOT_HOST',
  ROOM_NOT_FOUND: 'ROOM_NOT_FOUND',
  ROOM_FULL: 'ROOM_FULL',
  ROOM_LOCKED: 'ROOM_LOCKED',
  RATE_LIMITED: 'RATE_LIMITED',
  ILLEGAL_MOVE: 'ILLEGAL_MOVE',
  INTERNAL: 'INTERNAL',
});
