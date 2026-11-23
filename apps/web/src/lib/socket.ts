"use client";

/**
 * ============================================================================
 * SOCKET TRANSPORT — one interface, two adapters (STR/07)
 * ============================================================================
 *   · LiveSocketAdapter — socket.io-client against the real game server (S1).
 *     Auth rides the JWT session cookie: `withCredentials: true` (STR/07 §0).
 *     Every incoming payload is zod-validated in dev against the shared
 *     serverEventSchemas — the strict schemas reject any smuggled hidden
 *     card rank (defence-in-depth leak tripwire behind server filtering).
 *   · MockSocketAdapter — the deterministic scripted room (lib/mock/demo-room)
 *     that speaks the exact same event contract. Selectable via `?demo=1`
 *     (or by default until S1 lands); `?live=1` or NEXT_PUBLIC_TRANSPORT=live
 *     selects the real server together with NEXT_PUBLIC_SOCKET_URL.
 * ============================================================================
 */

import { io, type Socket } from "socket.io-client";
import {
  type AckResult,
  clientEventSchemas,
  type ClientAction,
  type EmitResult,
  type Handshake,
  type ServerEvent,
  type ServerEventName,
  flattenAck,
  serverEventSchemas,
} from "@/lib/wire";
import { MockRoom } from "@/lib/mock/demo-room";

export type TransportMode = "mock" | "live";

export interface SocketAdapter {
  readonly mode: TransportMode;
  connect(handshake: Handshake): Promise<void>;
  on(handler: (ev: ServerEvent) => void): () => void;
  emit(action: ClientAction): Promise<EmitResult>;
  disconnect(): void;
}

const ACK_TIMEOUT_MS = 10_000;

// ── live transport (socket.io-client) ──────────────────────────────────────

class LiveSocketAdapter implements SocketAdapter {
  readonly mode = "live" as const;
  private socket: Socket | null = null;
  private connectPromise: Promise<void> | null = null;

  private url(): string {
    return process.env.NEXT_PUBLIC_SOCKET_URL ?? ""; // "" = same origin (Caddy path per STR/06 §5)
  }

  connect(handshake: Handshake): Promise<void> {
    if (this.connectPromise) return this.connectPromise;
    this.connectPromise = new Promise<void>((resolve, reject) => {
      // Auth per STR/07 §0: the Socket.IO handshake carries the `lg_session`
      // cookie implicitly — withCredentials sends it. `auth` carries the
      // sessionIndependent identity (reconnect token etc.).
      const socket = io(this.url(), {
        withCredentials: true,
        auth: handshake as Record<string, unknown>,
      });
      this.socket = socket;
      socket.once("connect", () => resolve());
      socket.once("connect_error", (err: Error) => reject(err));
    });
    return this.connectPromise;
  }

  on(handler: (ev: ServerEvent) => void): () => void {
    const socket = this.socket;
    if (!socket) return () => undefined;
    const listener = (event: string, payload: unknown): void => {
      if (!(event in serverEventSchemas)) return; // ignore transport-level chatter
      const name = event as ServerEventName;
      const schema = serverEventSchemas[name];
      const parsed = schema.safeParse(payload);
      if (!parsed.success) {
        // dev tripwire: a payload outside the shared contract never reaches
        // the store (a hidden-rank leak fails LOUDLY, never silently)
        console.error(`[socket] payload for ${name} failed schema validation`, parsed.error.message);
        return;
      }
      handler({ event: name, payload: parsed.data } as ServerEvent);
    };
    socket.onAny(listener);
    return () => {
      socket.offAny(listener);
    };
  }

  async emit(action: ClientAction): Promise<EmitResult> {
    const socket = this.socket;
    if (!socket) return { ok: false, errorCode: "NO_CONNECTION", errorMessage: "Not connected yet." };
    const { event, payload } = toWireAction(action);
    const schema = clientEventSchemas[event];
    const parsed = schema.safeParse(payload);
    if (!parsed.success) {
      return { ok: false, errorCode: "VALIDATION", errorMessage: "That move wasn't valid." };
    }
    return await new Promise<EmitResult>((resolve) => {
      socket.timeout(ACK_TIMEOUT_MS).emit(event, parsed.data, (err: Error | null, ack?: AckResult<unknown>) => {
        if (err) resolve({ ok: false, errorCode: "ACK_TIMEOUT", errorMessage: "The table didn't answer in time." });
        else resolve(flattenAck(ack));
      });
    });
  }

  disconnect(): void {
    this.socket?.removeAllListeners();
    this.socket?.disconnect();
    this.socket = null;
    this.connectPromise = null;
  }
}

/** App action union → shared `{ event, payload }` wire event. */
function toWireAction(action: ClientAction): { event: keyof typeof clientEventSchemas; payload: Record<string, unknown> } {
  switch (action.type) {
    case "room:create":
      return { event: "room:create", payload: { name: action.name, capacity: action.capacity, theme: action.theme, visibility: action.visibility } };
    case "room:join":
      return { event: "room:join", payload: { code: action.code } };
    case "room:leave":
      return { event: "room:leave", payload: {} };
    case "game:start":
      return { event: "game:start", payload: {} };
    case "play:cards":
      return { event: "play:cards", payload: { cardIds: action.cardIds } };
    case "liar:call":
      return { event: "liar:call", payload: { accusedSeat: action.accusedSeat } };
    case "emote:send":
      return { event: "emote:send", payload: { emoteId: action.emoteId } };
    case "profile:tts-say":
      return { event: "profile:tts-say", payload: { phraseId: action.phraseId } };
    default: {
      const never: never = action;
      void never;
      throw new Error("unknown client action");
    }
  }
}

// ── mock transport (deterministic scripted room) ───────────────────────────

class MockSocketAdapter implements SocketAdapter {
  readonly mode = "mock" as const;
  private room = new MockRoom();
  private handler: ((ev: ServerEvent) => void) | null = null;
  private connectPromise: Promise<void> | null = null;

  connect(handshake: Handshake): Promise<void> {
    if (this.connectPromise) return this.connectPromise;
    this.room.setIdentity({ nickname: handshake.nickname, avatarSpec: handshake.avatarSpec ?? null });
    this.room.bind((ev) => this.handler?.(ev));
    this.connectPromise = new Promise<void>((resolve) => {
      // a beat of "walking over to the table", then presence marks us live
      setTimeout(() => {
        this.room.presence();
        resolve();
      }, 260);
    });
    return this.connectPromise;
  }

  on(handler: (ev: ServerEvent) => void): () => void {
    this.handler = handler;
    return () => {
      if (this.handler === handler) this.handler = null;
    };
  }

  async emit(action: ClientAction): Promise<EmitResult> {
    const { event, payload } = toWireAction(action);
    const parsed = clientEventSchemas[event].safeParse(payload);
    if (!parsed.success) {
      return { ok: false, errorCode: "VALIDATION", errorMessage: "That move wasn't valid." };
    }
    // game:start during game:over = REMATCH — the mock simply re-runs the
    // scripted match (host re-lobby seam lands with S1 per STR/03 §4)
    return this.room.handle(action);
  }

  disconnect(): void {
    this.room.leave();
    this.handler = null;
    this.connectPromise = null;
  }
}

// ── selection ──────────────────────────────────────────────────────────────

function resolveTransport(): TransportMode {
  if (typeof window === "undefined") return "mock"; // SSR/prerender — never dials out
  if (process.env.NODE_ENV === "test") return "mock";
  const params = new URLSearchParams(window.location.search);
  if (params.has("demo")) return "mock";
  const envMode = process.env.NEXT_PUBLIC_TRANSPORT;
  if (envMode === "live" || params.has("live")) return "live";
  return "mock"; // default until the S1 server wave lands
}

export const socket: SocketAdapter = resolveTransport() === "live" ? new LiveSocketAdapter() : new MockSocketAdapter();

export function socketMode(): TransportMode {
  return socket.mode;
}
