/**
 * registerGame — the S1 registration block called from src/index.ts right
 * after startServer(): mounts the authoritative game layer (RoomManager +
 * socket router) onto the existing Socket.IO server. No changes to app.ts
 * are needed: `io.to(code).emit` + per-socket join/leave cover the whole
 * transport (STR/07 deltas + seat-private hand:deal both ride room scopes —
 * sockets also auto-join their own id scope, used for direct sends).
 *
 * All injectable deps default to real infra (models consumed read-only):
 *  - hasEntitlement  → Entitlement.findOne (shop.ts lookup shape)
 *  - userProfile     → User.findById(...)
 *  - publicRoomStore → public_rooms upsert/remove (TTL 600s)
 *  - randomInt/Uuid  → node:crypto (never Math.random — STR/08 §3)
 */
import { randomInt as cryptoRandomInt, randomUUID } from 'node:crypto';
import type { Server as IOServer } from 'socket.io';
import { sanitizeDisplayName } from '@liars-game/shared';
import { Entitlement } from '../models/entitlement.js';
import { PublicRoom } from '../models/public-room.js';
import { User } from '../models/user.js';
import { attachGameRouter } from './router.js';
import { DEFAULT_GAME_TIMING, type GameDeps, type GameTiming, type PublicRoomDoc, type PublicRoomStore, type RoomTransport } from './types.js';
import { RoomManager, type ManagerDeps } from './rooms.js';

export interface GameLayer {
  manager: RoomManager;
  /** Detaches the io connection listener (tests/teardown). */
  detach(): void;
  /** Detaches + dissolves every room (server shutdown). */
  close(): void;
}

/** Monitors scoping: keep count of game-layer handled client events for smoke output. */
const CLIENT_EVENT_COUNT = 8;

// ── real-infrastructure defaults ─────────────────────────────────────────────

const defaultPublicRoomStore: PublicRoomStore = {
  async upsert(doc: PublicRoomDoc): Promise<void> {
    await PublicRoom.findByIdAndUpdate(
      doc.roomCode,
      {
        $set: {
          name: doc.name,
          hostNickname: doc.hostNickname,
          theme: doc.theme,
          capacity: doc.capacity,
          seatsTaken: doc.seatsTaken,
          visibility: doc.visibility,
          updatedAt: new Date(),
        },
      },
      { upsert: true },
    );
  },
  async remove(roomCode: string): Promise<void> {
    await PublicRoom.findByIdAndDelete(roomCode);
  },
};

export function registerGame(io: IOServer, deps: GameDeps): GameLayer {
  const transport: RoomTransport = {
    join(socketId, roomCode): void {
      io.sockets.sockets.get(socketId)?.join(roomCode);
    },
    leave(socketId, roomCode): void {
      io.sockets.sockets.get(socketId)?.leave(roomCode);
    },
    emitToRoom(roomCode, event, payload): void {
      io.to(roomCode).emit(event, payload);
    },
    emitToSocket(socketId, event, payload): void {
      io.to(socketId).emit(event, payload);
    },
  };

  const managerDeps: ManagerDeps = {
    authenticateSocket: deps.authenticateSocket,
    onMatchEnd: deps.onMatchEnd, // TODO-E1: wired at integration (grantMatchRewards)
    hasEntitlement: deps.hasEntitlement ?? (async (accountId, kind, key) => {
      const doc = await Entitlement.findOne({
        accountId,
        kind: kind as 'item' | 'theme' | 'title' | 'capacity',
        key,
      })
        .lean()
        .exec();
      return doc !== null;
    }),
    userProfile:
      deps.userProfile ??
      (async (accountId) => {
        const doc = await User.findById(accountId).select('avatarSpec activeTitle').lean().exec();
        if (!doc) return null;
        const row = doc as { avatarSpec?: unknown; activeTitle?: string | null };
        return { avatarSpec: row.avatarSpec ?? null, activeTitle: row.activeTitle ?? null };
      }),
    publicRoomStore: deps.publicRoomStore ?? defaultPublicRoomStore,
    randomInt:
      deps.randomInt ??
      ((minInclusive, maxInclusive) => cryptoRandomInt(minInclusive, maxInclusive + 1)),
    randomUuid: deps.randomUuid ?? randomUUID,
    now: deps.now ?? Date.now,
    timing: { ...DEFAULT_GAME_TIMING, ...(deps.timing ?? {}) } as Required<GameTiming>,
    matchConfig: deps.matchConfig,
    joinRateLimit: deps.joinRateLimit !== undefined ? deps.joinRateLimit : { windowMs: 600_000, limit: 10 },
    transport,
    sanitizeEmote: (raw) => sanitizeDisplayName(raw, { maxLength: 32 }),
  };

  const manager = new RoomManager(managerDeps);
  const router = attachGameRouter(io, manager, managerDeps);

  console.log(
    `[game] layer registered: RoomManager + ${CLIENT_EVENT_COUNT} client events → rules-engine (server-authoritative)`,
  );

  return {
    manager,
    detach(): void {
      router.detach();
    },
    close(): void {
      router.detach();
      manager.closeAll();
    },
  };
}

export { RoomManager } from './rooms.js';
export type { ManagerDeps, CreateOutcome, JoinOutcome, PublicRoomListing } from './rooms.js';
export { EMOTE_CATALOG, FREE_THEMES, BIG_TABLE_ENTITLEMENT } from './rooms.js';
export type { PublicRoomDoc, PublicRoomStore } from './rooms.js';
export type { MatchEndPayload, OnMatchEnd, GameDeps, GameTiming, RoomTransport } from './types.js';
export { MatchRuntime, wireCard } from './match.js';
export { TimerWheel } from './timers.js';
