import { afterEach, describe, expect, it, vi } from "vitest";
import { LiveSocketAdapter, socketMode, toWireAction, type ConnectIdentity } from "@/lib/socket";
import type { Socket } from "socket.io-client";

/**
 * ============================================================================
 * Transport tests — the wire-action mapping (the theme-slug seam included) and
 * the live adapter's drop/reconnect contract the GameBridge recovery relies on.
 * The socket.io client is faked via the adapter's injectable factory, so these
 * run hermetically (node, no server, no new deps).
 * ============================================================================
 */

/**
 * Connect payload used by the lifecycle tests — the wire carries NO handshake
 * tokens (STR/07 §0: cookie-only auth); only the local identity rides this.
 */
const ID: ConnectIdentity = { nickname: "MAVERICK" };

type Ack = (err: Error | null, ack?: unknown) => void;

/** Minimal socket.io-client stand-in covering everything LiveSocketAdapter touches. */
function fakeClient(): Socket & {
  fire: (event: string, ...args: unknown[]) => void;
  fireAny: (event: string, payload: unknown) => void;
  lastAck: () => Ack | null;
  disconnected: () => boolean;
} {
  const handlers = new Map<string, Set<(...args: unknown[]) => void>>();
  const onceHandlers = new Map<string, Set<(...args: unknown[]) => void>>();
  const anyHandlers = new Set<(event: string, payload: unknown) => void>();
  let lastAck: Ack | null = null;
  let isDisconnected = false;

  const client = {
    on(event: string, fn: (...args: unknown[]) => void) {
      if (!handlers.has(event)) handlers.set(event, new Set());
      handlers.get(event)?.add(fn);
    },
    once(event: string, fn: (...args: unknown[]) => void) {
      if (!onceHandlers.has(event)) onceHandlers.set(event, new Set());
      onceHandlers.get(event)?.add(fn);
    },
    onAny(fn: (event: string, payload: unknown) => void) {
      anyHandlers.add(fn);
    },
    offAny(fn: (event: string, payload: unknown) => void) {
      anyHandlers.delete(fn);
    },
    removeAllListeners() {
      handlers.clear();
      onceHandlers.clear();
      anyHandlers.clear();
      lastAck = null;
    },
    disconnect() {
      isDisconnected = true;
    },
    emit(_event: string, _payload: unknown, ack: Ack) {
      lastAck = ack;
    },
    timeout(_ms: number) {
      return {
        emit: (_event: string, _payload: unknown, ack: Ack) => {
          lastAck = ack;
        },
      };
    },
    // test-side controls (never used by the adapter)
    fire(event: string, ...args: unknown[]) {
      handlers.get(event)?.forEach((fn) => fn(...args));
      const oncers = onceHandlers.get(event);
      if (oncers && oncers.size > 0) {
        onceHandlers.set(event, new Set()); // `once` semantics
        oncers.forEach((fn) => fn(...args));
      }
    },
    fireAny(event: string, payload: unknown) {
      anyHandlers.forEach((fn) => fn(event, payload));
    },
    lastAck() {
      return lastAck;
    },
    disconnected() {
      return isDisconnected;
    },
  };
  return client as unknown as Socket & {
    fire: (event: string, ...args: unknown[]) => void;
    fireAny: (event: string, payload: unknown) => void;
    lastAck: () => Ack | null;
    disconnected: () => boolean;
  };
}

/** Adapter wired to record every fake the factory mints. */
function liveAdapterWithFake(): { adapter: LiveSocketAdapter; made: Array<ReturnType<typeof fakeClient>> } {
  const made: Array<ReturnType<typeof fakeClient>> = [];
  const adapter = new LiveSocketAdapter((_url, _opts) => {
    const f = fakeClient();
    made.push(f);
    return f as unknown as Socket;
  });
  return { adapter, made };
}

const flush = (): Promise<void> => new Promise((res) => setTimeout(res, 0));

afterEach(() => {
  vi.restoreAllMocks();
});

describe("toWireAction — action union → { event, payload }", () => {
  it("maps every in-game action onto the shared event names", () => {
    expect(toWireAction({ type: "room:join", code: "TESTY" })).toEqual({
      event: "room:join",
      payload: { code: "TESTY" },
    });
    expect(toWireAction({ type: "room:leave" })).toEqual({ event: "room:leave", payload: {} });
    expect(toWireAction({ type: "game:start" })).toEqual({ event: "game:start", payload: {} });
    expect(toWireAction({ type: "play:cards", cardIds: ["a", "b"] })).toEqual({
      event: "play:cards",
      payload: { cardIds: ["a", "b"] },
    });
    expect(toWireAction({ type: "liar:call", accusedSeat: 2 })).toEqual({
      event: "liar:call",
      payload: { accusedSeat: 2 },
    });
    expect(toWireAction({ type: "emote:send", emoteId: "laugh" })).toEqual({
      event: "emote:send",
      payload: { emoteId: "laugh" },
    });
    expect(toWireAction({ type: "profile:tts-say", phraseId: "gg" })).toEqual({
      event: "profile:tts-say",
      payload: { phraseId: "gg" },
    });
  });

  it("normalizes the theme slug on room:create (idempotent for pre-slugified callers)", () => {
    const fromId = toWireAction({
      type: "room:create",
      name: "TABLE",
      capacity: 4,
      theme: "house",
      visibility: "private",
    });
    expect(fromId.event).toBe("room:create");
    expect(fromId.payload.theme).toBe("house-table"); // UI catalog id → server slug

    const alreadySlug = toWireAction({
      type: "room:create",
      name: "TABLE",
      capacity: 4,
      theme: "house-table" as never as "house",
      visibility: "private",
    });
    expect(alreadySlug.payload.theme).toBe("house-table"); // pass-through — never double-mapped

    const saloon = toWireAction({
      type: "room:create",
      name: "TABLE",
      capacity: 4,
      theme: "saloon",
      visibility: "public",
    });
    expect(saloon.payload.theme).toBe("saloon");
  });

  it("throws on an unknown action (compile-time exhaustiveness made runtime-loud)", () => {
    expect(() => toWireAction({ type: "nope" } as never)).toThrow("unknown client action");
  });
});

describe("LiveSocketAdapter — transport lifecycle", () => {
  it("node/test ambient resolves the mock transport (the suite never dials out)", () => {
    expect(socketMode()).toBe("mock");
  });

  it("connect resolves on the first connect, is memoized, and signals 'connected' once", async () => {
    const { adapter, made } = liveAdapterWithFake();
    const statuses: string[] = [];
    adapter.onStatus((s) => statuses.push(s));
    const connected = adapter.connect(ID);
    expect(adapter.connect(ID)).toBe(connected); // memoized — exactly one dial
    made[0]?.fire("connect");
    await connected;
    expect(statuses).toEqual(["connected"]);
    expect(adapter.mode).toBe("live");
  });

  it("a mid-match drop signals 'dropped'; the restored transport signals 'reconnected'", async () => {
    const { adapter, made } = liveAdapterWithFake();
    const statuses: string[] = [];
    adapter.onStatus((s) => statuses.push(s));
    const connected = adapter.connect(ID);
    made[0]?.fire("connect");
    await connected;

    made[0]?.fire("disconnect", "transport close"); // mid-match drop
    made[0]?.fire("connect"); // socket.io auto-restored the transport on its own
    expect(statuses).toEqual(["connected", "dropped", "reconnected"]);
  });

  it("a failed FIRST connect rejects, tears the fake down, and a retry dials fresh", async () => {
    const { adapter, made } = liveAdapterWithFake();
    const first = adapter.connect(ID);
    made[0]?.fire("connect_error", new Error("boom"));
    await expect(first).rejects.toThrow("boom");
    expect(made[0]?.disconnected()).toBe(true); // no half-open socket left behind

    const second = adapter.connect(ID); // must not inherit the poisoned memo
    made[1]?.fire("connect");
    await second;
    expect(made).toHaveLength(2); // a fresh client was dialed
  });

  it("a failed reconnect RETRY after a good session stays silent (socket.io owns retries)", async () => {
    const { adapter, made } = liveAdapterWithFake();
    const statuses: string[] = [];
    adapter.onStatus((s) => statuses.push(s));
    const connected = adapter.connect(ID);
    made[0]?.fire("connect");
    await connected;
    made[0]?.fire("disconnect", "ping timeout");
    made[0]?.fire("connect_error", new Error("still down")); // one of socket.io's retries failing
    expect(statuses).toEqual(["connected", "dropped"]);
    expect(made).toHaveLength(1); // no teardown — the same client keeps retrying
  });

  it("onStatus unsubscribe stops delivery", async () => {
    const { adapter, made } = liveAdapterWithFake();
    const seen: string[] = [];
    const off = adapter.onStatus((s) => seen.push(s));
    const connected = adapter.connect(ID);
    made[0]?.fire("connect");
    await connected;
    off();
    made[0]?.fire("disconnect", "transport close");
    expect(seen).toEqual(["connected"]);
  });
});

describe("LiveSocketAdapter — inbound validation (leak tripwire)", () => {
  it("forwards contract events; filters unknown names and malformed payloads", async () => {
    const { adapter, made } = liveAdapterWithFake();
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const connected = adapter.connect(ID);
    made[0]?.fire("connect");
    await connected;

    const seen: Array<{ event: string; seq?: number }> = [];
    adapter.on((ev) => seen.push({ event: ev.event, seq: (ev.payload as { seq?: number }).seq }));

    made[0]?.fireAny("emote:broadcast", { seq: 3, seat: 1, emoteId: "laugh" });
    made[0]?.fireAny("not-in-the-contract", { seq: 4 }); // transport chatter — ignored
    made[0]?.fireAny("emote:broadcast", { seq: 5, seat: 1 }); // malformed — dropped loudly

    expect(seen).toEqual([{ event: "emote:broadcast", seq: 3 }]);
    expect(errSpy).toHaveBeenCalledTimes(1);
  });
});

describe("LiveSocketAdapter — outbound emit", () => {
  it("validates against the shared schema BEFORE anything leaves the browser", async () => {
    const { adapter, made } = liveAdapterWithFake();
    const connected = adapter.connect(ID);
    made[0]?.fire("connect");
    await connected;

    const bad = await adapter.emit({ type: "emote:send", emoteId: "" });
    expect(bad.ok).toBe(false);
    expect(bad.errorCode).toBe("VALIDATION");
    expect(made[0]?.lastAck()).toBeNull(); // never reached the transport
  });

  it("a clean ack flattens to the screens' EmitResult shape", async () => {
    const { adapter, made } = liveAdapterWithFake();
    const connected = adapter.connect(ID);
    made[0]?.fire("connect");
    await connected;

    const res = adapter.emit({ type: "emote:send", emoteId: "laugh" });
    made[0]?.lastAck()?.(null, { ok: true, data: null });
    await expect(res).resolves.toEqual({ ok: true });
  });

  it("a room:join ack flattens to { ok, code, spectator, yourSeat }", async () => {
    const { adapter, made } = liveAdapterWithFake();
    const connected = adapter.connect(ID);
    made[0]?.fire("connect");
    await connected;

    const res = adapter.emit({ type: "room:join", code: "TESTY" });
    made[0]?.lastAck()?.(null, { ok: true, data: { roomCode: "TESTY", spectator: false, yourSeat: 0 } });
    await expect(res).resolves.toEqual({ ok: true, code: "TESTY", spectator: false, yourSeat: 0 });
  });

  it("an ack timeout never throws — it resolves { ok:false, ACK_TIMEOUT }", async () => {
    const { adapter, made } = liveAdapterWithFake();
    const connected = adapter.connect(ID);
    made[0]?.fire("connect");
    await connected;

    const res = adapter.emit({ type: "game:start" });
    made[0]?.lastAck()?.(new Error("timeout"));
    await expect(res).resolves.toMatchObject({ ok: false, errorCode: "ACK_TIMEOUT" });
  });

  it("emitting before connect resolves NO_CONNECTION, never throws", async () => {
    const adapter = new LiveSocketAdapter();
    const res = await adapter.emit({ type: "game:start" });
    expect(res.ok).toBe(false);
    expect(res.errorCode).toBe("NO_CONNECTION");
  });
});
