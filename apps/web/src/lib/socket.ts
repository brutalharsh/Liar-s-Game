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
 *
 *   MID-MATCH DROPS — intended behavior (STR/03 §3 / STR/07 §4):
 *   socket.io itself auto-reconnects the transport; the STORE then rejoins.
 *   The room code is the seat authority (no reconnect token on the wire),
 *   so a restored transport is not enough — GameBridge listens to
 *   `onStatus` and on "reconnected" re-emits `room:join` (idempotent
 *   server-side; the answer is ONE catch-up `lobby:state` whose seq
 *   supersedes every event missed during the drop — we never replay
 *   deltas). The same rejoin runs when the store flags a seq gap.
 *   A failed FIRST connect never poisons the adapter: `connect()` clears
 *   its memo so a later call dials fresh. The mock never drops, so it
 *   simply never signals.
 * ============================================================================
 */

import { io, type Socket } from "socket.io-client";
import {
  type AckResult,
  clientEventSchemas,
  type ClientAction,
  type EmitResult,
  type ServerEvent,
  type ServerEventName,
  type WireAvatarSpec,
  flattenAck,
  serverEventSchemas,
  themeToWire,
} from "@/lib/wire";
import { MockRoom } from "@/lib/mock/demo-room";

export type TransportMode = "mock" | "live";

/**
 * Local identity payload handed to `connect`. This is APP-side only — NOT a
 * wire contract: the live transport authenticates purely via the `lg_session`
 * cookie (withCredentials, STR/07 §0 — there is no guest/reconnect token on
 * the wire). The mock adapter consumes the nickname/avatarSpec to script the
 * hero seat.
 */
export interface ConnectIdentity {
  nickname?: string;
  avatarSpec?: WireAvatarSpec;
}

/**
 * Transport lifecycle (live adapter only; the mock never fires).
 *   · "connected"  — first transport-level connection (the connect() promise also resolves)
 *   · "reconnected" — socket.io restored the transport after a mid-match drop
 *   · "dropped"     — transport lost; socket.io will keep retrying on its own
 */
export type SocketStatus = "connected" | "reconnected" | "dropped";

export interface SocketAdapter {
  readonly mode: TransportMode;
  connect(identity: ConnectIdentity): Promise<void>;
  on(handler: (ev: ServerEvent) => void): () => void;
  /** Subscribe to transport lifecycle changes. Unsubscribe = returned fn. */
  onStatus(handler: (status: SocketStatus) => void): () => void;
  emit(action: ClientAction): Promise<EmitResult>;
  disconnect(): void;
}

const ACK_TIMEOUT_MS = 10_000;

// ── live transport (socket.io-client) ──────────────────────────────────────

/** Live adapter (exported for unit tests — the app only uses the `socket` singleton). */
export class LiveSocketAdapter implements SocketAdapter {
  readonly mode = "live" as const;
  private socket: Socket | null = null;
  private connectPromise: Promise<void> | null = null;
  private everConnected = false;
  private statusHandlers = new Set<(status: SocketStatus) => void>();

  /** Injectable client factory so the reconnect contract is unit-testable. */
  constructor(
    private makeClient: (url: string, opts: { withCredentials: boolean; auth: Record<string, unknown> }) => Socket = (url, opts) => io(url, opts),
  ) {}

  private url(): string {
    return process.env.NEXT_PUBLIC_SOCKET_URL ?? ""; // "" = same origin (Caddy path per STR/06 §5)
  }

  private emitStatus(status: SocketStatus): void {
    for (const handler of this.statusHandlers) handler(status);
  }

  connect(_identity: ConnectIdentity): Promise<void> {
    if (this.connectPromise) return this.connectPromise;
    this.everConnected = false;
    this.connectPromise = new Promise<void>((resolve, reject) => {
      // Auth per STR/07 §0: the Socket.IO handshake carries the `lg_session`
      // cookie implicitly — withCredentials sends it. NOTHING rides `auth`
      // (no guest/reconnect tokens exist on the wire; identity comes from
      // the session + DB server-side), so the identity payload is ignored
      // here — only the mock adapter consumes it.
      const socket = this.makeClient(this.url(), {
        withCredentials: true,
        auth: {},
      });
      this.socket = socket;
      socket.on("connect", () => {
        if (this.everConnected) this.emitStatus("reconnected");
        else {
          this.everConnected = true;
          this.emitStatus("connected");
          resolve();
        }
      });
      socket.on("disconnect", () => this.emitStatus("dropped"));
      socket.once("connect_error", (err: Error) => {
        if (this.everConnected) return; // a failed reconnect retry — socket.io keeps trying
        this.teardown(); // a dead first connect must not poison the adapter: allow a fresh dial
        reject(err);
      });
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

  onStatus(handler: (status: SocketStatus) => void): () => void {
    this.statusHandlers.add(handler);
    return () => {
      this.statusHandlers.delete(handler);
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

  private teardown(): void {
    this.socket?.removeAllListeners();
    this.socket?.disconnect();
    this.socket = null;
    this.connectPromise = null;
  }

  disconnect(): void {
    this.teardown();
  }
}

/** App action union → shared `{ event, payload }` wire event. */
export function toWireAction(action: ClientAction): {
  event: keyof typeof clientEventSchemas;
  payload: Record<string, unknown>;
} {
  switch (action.type) {
    case "room:create":
      // theme: catalog id → validated wire slug ('house' rides out as
      // 'house-table'); already-slugified values pass through (idempotent)
      return {
        event: "room:create",
        payload: {
          name: action.name,
          capacity: action.capacity,
          theme: themeToWire(action.theme),
          visibility: action.visibility,
        },
      };
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

  connect(identity: ConnectIdentity): Promise<void> {
    if (this.connectPromise) return this.connectPromise;
    this.room.setIdentity({ nickname: identity.nickname, avatarSpec: identity.avatarSpec ?? null });
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

  /** The scripted room never drops the transport — no status ever fires. */
  onStatus(): () => void {
    return () => undefined;
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

/**
 * Which adapter the app runs on:
 *   · SSR/prerender and `NODE_ENV=test` → always mock (never dials out)
 *   · `?demo` in the URL → mock (deterministic scripted room)
 *   · `?live` or `NEXT_PUBLIC_TRANSPORT=live` → live (with NEXT_PUBLIC_SOCKET_URL;
 *     "" = same origin via the Caddy path per STR/06 §5)
 *   · otherwise → mock (the default until the deploy wave)
 * The adapter is a module singleton: within a session the transport is fixed
 * (a full reload re-resolves it). GameBridge reacts to transport state purely
 * through `onStatus`, so both adapters share one recovery path.
 */
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
