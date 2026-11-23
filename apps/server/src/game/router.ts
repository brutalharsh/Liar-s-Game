/**
 * Socket event router (STR/07 §1 → §2): binds the eight client events to the
 * RoomManager. Every payload is zod-validated through @liars-game/shared
 * (AGENTS.md rule: zod-parse EVERY socket input); every handler requires a
 * resolved session first (STR/07 §0 — unauthenticated sockets may connect
 * but play events bounce `AUTH_REQUIRED`). Engine rejections ride their typed
 * codes back to the offending socket; rejected actions never mutate state.
 *
 * Crash containment (STR/10 P0 follow-up): Node kills the process on any
 * unhandled rejection, and handler bugs reach exactly that unless funneled.
 * Every handler runs inside `runGuarded`, which turns BOTH sync throws and
 * async rejections into a server-side log + the standard INTERNAL rejection
 * for the offending client (user-safe text — the raw error/stack never
 * crosses the wire) + a RESOLVED promise. Node crash surface stays empty.
 */
import type { Server, Socket } from 'socket.io';
import type { z } from 'zod';
import {
  EmoteSendPayloadSchema,
  GameStartPayloadSchema,
  LiarCallPayloadSchema,
  PlayCardsPayloadSchema,
  TtsSayPayloadSchema,
  RoomCreatePayloadSchema,
  RoomJoinPayloadSchema,
  RoomLeavePayloadSchema,
  type Ack,
} from '@liars-game/shared';
import type { SessionUser } from '../middleware/auth.js';
import type {
  ActionResult,
  CreateOutcome,
  JoinOutcome,
  ManagerDeps,
  RoomManager,
} from './rooms.js';
import { GAME_ERROR_CODES, type GameSocket } from './types.js';

export interface GameRouter {
  detach(): void;
}

function ackOk<T>(ack: unknown, data: T): void {
  if (typeof ack === 'function') (ack as Ack<T>)({ ok: true, data });
}

function ackErr(ack: unknown, code: string, message: string): void {
  if (typeof ack === 'function') (ack as Ack<never>)({ ok: false, error: { code, message } });
}

/** Server-side crash breadcrumb: event name + real stack, never the client's. */
function crashLog(scope: string, err: unknown): void {
  console.error(
    `[game-router] ${scope} failed`,
    err instanceof Error ? err.stack ?? String(err) : String(err),
  );
}

/** Strict zod parse → typed payload or null (VALIDATION path factored out). */
function parse<S extends z.ZodType>(schema: S, raw: unknown): z.infer<S> | null {
  const result = schema.safeParse(raw);
  return result.success ? result.data : null;
}

/** One resolving lookup per socket (cached on socket.data.authResolved). */
async function resolveUser(socket: GameSocket, deps: ManagerDeps): Promise<SessionUser | null> {
  if (!socket.data.authResolved) {
    socket.data.authResolved = (async () => {
      if (socket.data.user) return socket.data.user; // S-A1's mount resolved it
      const user = await deps.authenticateSocket(socket);
      socket.data.user = user;
      return user;
    })();
  }
  return socket.data.authResolved;
}

interface HandlerCtx {
  manager: RoomManager;
  deps: ManagerDeps;
}

/** Uniform rejection: ack error + `error` event (user-safe, never leaks state). */
function reject(
  ctx: HandlerCtx,
  socket: GameSocket,
  ack: unknown,
  eventRef: string,
  code: string,
  message: string,
): void {
  ctx.manager.emitError(socket.id, code, message, eventRef);
  ackErr(ack, code, message);
}

/**
 * Last resort after a handler crashed — itself fully contained: a broken
 * reject path (dead transport emit, hostile client ack) must not escalate the
 * caught crash back into an unhandled rejection, and the client should still
 * get its INTERNAL ack instead of hanging on the ack timeout.
 */
function failSafe(
  ctx: HandlerCtx,
  socket: GameSocket,
  ack: unknown,
  eventRef: string,
  err: unknown,
): void {
  crashLog(`handler "${eventRef}"`, err);
  try {
    reject(ctx, socket, ack, eventRef, GAME_ERROR_CODES.INTERNAL, 'internal error, please retry');
  } catch (replyErr: unknown) {
    crashLog(`reject path for "${eventRef}"`, replyErr);
    try {
      ackErr(ack, GAME_ERROR_CODES.INTERNAL, 'internal error, please retry');
    } catch (ackErr2: unknown) {
      crashLog(`ack fallback for "${eventRef}"`, ackErr2);
    }
  }
}

/**
 * Runs ONE handler body under containment. `fn` is an async closure, so even
 * synchronous throws inside it surface as rejections — caught here, logged
 * via `failSafe`, and answered with the INTERNAL rejection. The returned
 * promise ALWAYS resolves (Socket.IO ignores listener return values; tests
 * use it to assert no rejection ever escapes).
 */
function runGuarded(
  ctx: HandlerCtx,
  socket: GameSocket,
  ack: unknown,
  eventRef: string,
  fn: () => Promise<void>,
): Promise<void> {
  return fn().catch((err: unknown) => {
    failSafe(ctx, socket, ack, eventRef, err);
  });
}

async function requireUser(
  ctx: HandlerCtx,
  socket: GameSocket,
  ack: unknown,
  eventRef: string,
): Promise<SessionUser | null> {
  const user = await resolveUser(socket, ctx.deps);
  if (!user) {
    reject(ctx, socket, ack, eventRef, GAME_ERROR_CODES.AUTH_REQUIRED, 'login required to play');
    return null;
  }
  return user;
}

export function attachGameRouter(io: Server, manager: RoomManager, deps: ManagerDeps): GameRouter {
  const ctx: HandlerCtx = { manager, deps };

  const connectionListener = (rawSocket: Socket): void => {
    try {
      const socket = rawSocket as GameSocket;

      socket.on('room:create', (raw: unknown, ack?: unknown) =>
        runGuarded(ctx, socket, ack, 'room:create', async () => {
          const user = await requireUser(ctx, socket, ack, 'room:create');
          if (!user) return;
          const payload = parse(RoomCreatePayloadSchema, raw);
          if (!payload) {
            reject(ctx, socket, ack, 'room:create', GAME_ERROR_CODES.VALIDATION, 'invalid payload');
            return;
          }
          const res: ActionResult<CreateOutcome> = await ctx.manager.createRoom({
            userId: user.id,
            nickname: user.nickname,
            name: payload.name,
            capacity: payload.capacity,
            theme: payload.theme,
            visibility: payload.visibility,
            socketId: socket.id,
          });
          if (!res.ok) {
            reject(ctx, socket, ack, 'room:create', res.code, res.message);
            return;
          }
          ctx.manager.roomOfSocket(socket.id)?.emitSnapshotToSocket(socket.id);
          ackOk(ack, { roomCode: res.data.roomCode });
        }),
      );

      socket.on('room:join', (raw: unknown, ack?: unknown) =>
        runGuarded(ctx, socket, ack, 'room:join', async () => {
          const user = await requireUser(ctx, socket, ack, 'room:join');
          if (!user) return;
          const payload = parse(RoomJoinPayloadSchema, raw);
          if (!payload) {
            reject(ctx, socket, ack, 'room:join', GAME_ERROR_CODES.VALIDATION, 'invalid payload');
            return;
          }
          const res: ActionResult<JoinOutcome> = await ctx.manager.joinRoom({
            userId: user.id,
            nickname: user.nickname,
            socketId: socket.id,
            code: payload.code,
            address: socket.handshake?.address ?? null,
          });
          if (!res.ok) {
            reject(ctx, socket, ack, 'room:join', res.code, res.message);
            return;
          }
          // `reconnected` is an extra hint for the "Welcome back" banner; the
          // shared ack type's core fields (roomCode/spectator/yourSeat) lead.
          ackOk(ack, {
            roomCode: res.data.roomCode,
            spectator: res.data.spectator,
            yourSeat: res.data.yourSeat,
            reconnected: res.data.reconnected,
          });
        }),
      );

      socket.on('room:leave', (raw: unknown, ack?: unknown) =>
        runGuarded(ctx, socket, ack, 'room:leave', async () => {
          const user = await requireUser(ctx, socket, ack, 'room:leave');
          if (!user) return;
          const payload = parse(RoomLeavePayloadSchema, raw);
          if (!payload) {
            reject(ctx, socket, ack, 'room:leave', GAME_ERROR_CODES.VALIDATION, 'invalid payload');
            return;
          }
          const res = ctx.manager.leaveSocket(socket.id, user.id);
          if (!res.ok) {
            reject(ctx, socket, ack, 'room:leave', res.code, res.message);
            return;
          }
          ackOk(ack, null);
        }),
      );

      socket.on('game:start', (raw: unknown, ack?: unknown) =>
        runGuarded(ctx, socket, ack, 'game:start', async () => {
          const user = await requireUser(ctx, socket, ack, 'game:start');
          if (!user) return;
          const payload = parse(GameStartPayloadSchema, raw);
          if (!payload) {
            reject(ctx, socket, ack, 'game:start', GAME_ERROR_CODES.VALIDATION, 'invalid payload');
            return;
          }
          const res = await ctx.manager.startMatch(user.id);
          if (!res.ok) {
            reject(ctx, socket, ack, 'game:start', res.code, res.message);
            return;
          }
          ackOk(ack, null);
        }),
      );

      socket.on('play:cards', (raw: unknown, ack?: unknown) =>
        runGuarded(ctx, socket, ack, 'play:cards', async () => {
          const user = await requireUser(ctx, socket, ack, 'play:cards');
          if (!user) return;
          const payload = parse(PlayCardsPayloadSchema, raw);
          if (!payload) {
            reject(ctx, socket, ack, 'play:cards', GAME_ERROR_CODES.VALIDATION, 'invalid payload');
            return;
          }
          const res = ctx.manager.playCards(socket.id, payload.cardIds);
          if (!res.ok) {
            reject(ctx, socket, ack, 'play:cards', res.code, res.message);
            return;
          }
          ackOk(ack, { seq: res.data.seq });
        }),
      );

      socket.on('liar:call', (raw: unknown, ack?: unknown) =>
        runGuarded(ctx, socket, ack, 'liar:call', async () => {
          const user = await requireUser(ctx, socket, ack, 'liar:call');
          if (!user) return;
          const payload = parse(LiarCallPayloadSchema, raw);
          if (!payload) {
            reject(ctx, socket, ack, 'liar:call', GAME_ERROR_CODES.VALIDATION, 'invalid payload');
            return;
          }
          const res = ctx.manager.callLiar(socket.id, payload.accusedSeat);
          if (!res.ok) {
            reject(ctx, socket, ack, 'liar:call', res.code, res.message);
            return;
          }
          ackOk(ack, { seq: res.data.seq });
        }),
      );

      socket.on('emote:send', (raw: unknown, ack?: unknown) =>
        runGuarded(ctx, socket, ack, 'emote:send', async () => {
          const user = await requireUser(ctx, socket, ack, 'emote:send');
          if (!user) return;
          const payload = parse(EmoteSendPayloadSchema, raw);
          if (!payload) {
            reject(ctx, socket, ack, 'emote:send', GAME_ERROR_CODES.VALIDATION, 'invalid payload');
            return;
          }
          const res = ctx.manager.sendEmote(socket.id, payload.emoteId);
          if (!res.ok) {
            reject(ctx, socket, ack, 'emote:send', res.code, res.message);
            return;
          }
          ackOk(ack, null);
        }),
      );

      socket.on('profile:tts-say', (raw: unknown, ack?: unknown) =>
        runGuarded(ctx, socket, ack, 'profile:tts-say', async () => {
          const user = await requireUser(ctx, socket, ack, 'profile:tts-say');
          if (!user) return;
          const payload = parse(TtsSayPayloadSchema, raw);
          if (!payload) {
            reject(ctx, socket, ack, 'profile:tts-say', GAME_ERROR_CODES.VALIDATION, 'invalid payload');
            return;
          }
          // TTS is client-local (STR/07 §1): NO audio ever rides the wire.
          const res = ctx.manager.ttsSay(socket.id, payload.phraseId);
          if (!res.ok) {
            reject(ctx, socket, ack, 'profile:tts-say', res.code, res.message);
            return;
          }
          ackOk(ack, null);
        }),
      );

      // No ack on transport-level disconnects: containment here is log-only
      // (the `error` emission failSafe attempts dead-letters on a gone socket).
      socket.on('disconnect', () =>
        runGuarded(ctx, socket, undefined, 'disconnect', async () => {
          ctx.manager.socketDisconnected(socket.id);
        }),
      );
    } catch (err: unknown) {
      // Binding crash (poisoned socket): contain it here — one dead socket
      // loses its handlers instead of the process losing every room.
      crashLog('connection listener', err);
    }
  };

  io.on('connection', connectionListener);
  return {
    detach(): void {
      io.off('connection', connectionListener);
    },
  };
}
