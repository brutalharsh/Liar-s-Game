import { describe, expect, it } from "vitest";
import { createTransportRecovery } from "@/components/GameBridge";
import { createGameStore, type GameStore } from "@/store/game";
import {
  parseServerEvent,
  type ClientAction,
  type EmitResult,
  type ServerEvent,
  type ServerEventName,
} from "@/lib/wire";

/**
 * ============================================================================
 * createTransportRecovery — the seq-gap + transport recovery contract
 * ============================================================================
 * Hermetic (node) harness: a fresh store per case, a manually-resolved emit
 * seam (so ack timing is deterministic), and a toast spy. The component wiring
 * under test is exactly what GameBridge mounts: store.subscribe →
 * onStoreChange, adapter onStatus → onTransportStatus.
 * ============================================================================
 */

function snapshotEvent(seq: number, code = "TESTY"): ServerEvent {
  const parsed = parseServerEvent("lobby:state", {
    roomCode: code,
    name: "TEST TABLE",
    capacity: 2,
    theme: "saloon",
    visibility: "private",
    phase: "lobby",
    hostSeat: 0,
    seq,
    seats: [
      {
        seat: 0,
        nickname: "YOU",
        avatarSpec: { base: "fox" },
        connected: true,
        afk: false,
        isHost: true,
        handCount: 0,
        pulls: 0,
        alive: true,
        activeTitle: null,
      },
      {
        seat: 1,
        nickname: "SCUBB",
        avatarSpec: { base: "raccoon" },
        connected: true,
        afk: false,
        isHost: false,
        handCount: 0,
        pulls: 0,
        alive: true,
        activeTitle: null,
      },
    ],
    you: {
      seat: 0,
      nickname: "YOU",
      avatarSpec: { base: "fox" },
      connected: true,
      afk: false,
      isHost: true,
      hand: [],
      handCount: 0,
      pulls: 0,
      alive: true,
      activeTitle: null,
    },
    spectator: false,
    estMatchMinutes: 8,
  });
  return { event: "lobby:state", payload: parsed } as ServerEvent;
}

function delta(name: ServerEventName, seq: number, payload: Record<string, unknown>): ServerEvent {
  const parsed = parseServerEvent(name, { ...payload, seq });
  return { event: name, payload: parsed } as ServerEvent;
}

/** Flush the microtask queue so emit().then callbacks run. */
const tick = (): Promise<void> => new Promise((res) => setTimeout(res, 0));

class Harness {
  store: ReturnType<typeof createGameStore>;
  sent: ClientAction[] = [];
  pendingAcks: Array<(res: EmitResult) => void> = [];
  toasts: { title: string; tone: "info" | "good" | "bad" }[] = [];
  recovery: ReturnType<typeof createTransportRecovery>;
  unsubscribe: () => void;

  constructor() {
    this.store = createGameStore(
      (action) =>
        new Promise<EmitResult>((resolve) => {
          this.sent.push(action);
          this.pendingAcks.push(resolve);
        }),
    );
    this.recovery = createTransportRecovery({
      store: this.store,
      emit: (action) =>
        new Promise<EmitResult>((resolve) => {
          this.sent.push(action);
          this.pendingAcks.push(resolve);
        }),
      push: (toast) => {
        this.toasts.push(toast);
      },
    });
    // the exact wiring GameBridge mounts
    this.unsubscribe = this.store.subscribe(() => this.recovery.onStoreChange());
  }

  ack(res: EmitResult): void {
    const resolve = this.pendingAcks.shift();
    resolve?.(res);
  }

  apply(ev: ServerEvent): void {
    this.store.getState().applyEvent(ev);
  }
}

describe("createTransportRecovery — seq gap → re-join", () => {
  it("a seq gap triggers exactly one re-join while the ack is pending (no thundering re-join)", async () => {
    const h = new Harness();
    h.apply(snapshotEvent(0));
    h.apply(delta("play:accept", 1, { seat: 0, count: 2, totalPile: 2 }));
    h.apply(delta("play:accept", 5, { seat: 1, count: 1, totalPile: 3 })); // gap 2–4

    expect(h.sent).toEqual([{ type: "room:join", code: "TESTY" }]); // ONE rejoin, not N
    expect(h.toasts.at(-1)?.title).toBe("Resyncing the table…");

    // further rapid gaps while the join ack is pending must NOT stack joins
    h.apply(delta("play:accept", 8, { seat: 0, count: 1, totalPile: 4 }));
    h.apply(delta("play:accept", 9, { seat: 1, count: 1, totalPile: 5 }));
    expect(h.sent).toHaveLength(1);

    // ack resolves while the flag is still raised (ack-before-snapshot
    // packet order): exactly ONE silent retry, bounded
    h.ack({ ok: true });
    await tick();
    expect(h.sent).toHaveLength(2);
    expect(h.sent[1]).toEqual({ type: "room:join", code: "TESTY" });
    expect(h.toasts).toHaveLength(1); // the retry is silent

    // the catch-up snapshot lands → the loop converges, no third join
    h.apply(snapshotEvent(9));
    h.ack({ ok: true });
    await tick();
    expect(h.sent).toHaveLength(2);
    expect(h.store.getState().needsSnapshot).toBe(false);
    h.unsubscribe();
  });

  it("snapshot arrives before the ack → no retry at all", async () => {
    const h = new Harness();
    h.apply(snapshotEvent(0));
    h.apply(delta("play:accept", 7, { seat: 0, count: 1, totalPile: 1 })); // gap
    expect(h.sent).toHaveLength(1);

    h.apply(snapshotEvent(7)); // server pushed the catch-up before the ack
    h.ack({ ok: true });
    await tick();
    expect(h.sent).toHaveLength(1); // flag already cleared — re-check no-ops
    expect(h.store.getState().needsSnapshot).toBe(false);
    h.unsubscribe();
  });

  it("a rejected join keeps the flag raised and retries on the next event", async () => {
    const h = new Harness();
    h.apply(snapshotEvent(0));
    h.apply(delta("play:accept", 4, { seat: 0, count: 1, totalPile: 1 })); // gap
    expect(h.sent).toHaveLength(1);

    h.ack({ ok: false, errorCode: "ROOM_FULL", errorMessage: "Table's packed." });
    await tick();
    expect(h.sent).toHaveLength(1); // a failure alone doesn't auto-hammer

    h.apply(delta("presence:update", 5, { seats: [{ seat: 1, connected: true, afk: false }] }));
    expect(h.sent).toHaveLength(2); // the next incoming event retries the rejoin
    h.ack({ ok: true });
    h.apply(snapshotEvent(5));
    await tick();
    expect(h.store.getState().needsSnapshot).toBe(false);
    h.unsubscribe();
  });

  it("a gap without a known room code emits nothing (nothing to rejoin)", () => {
    const h = new Harness(); // fresh store — never joined
    h.recovery.onStoreChange();
    expect(h.sent).toHaveLength(0);
    h.unsubscribe();
  });
});

describe("createTransportRecovery — transport lifecycle (live drops)", () => {
  it("dropped → connected false + toast; reconnected → connected true + one rebind join", async () => {
    const h = new Harness();
    h.apply(snapshotEvent(0));
    h.store.getState().setConnected(true); // the initial connect landed us in the room

    h.recovery.onTransportStatus("dropped");
    expect(h.store.getState().connected).toBe(false);
    expect(h.toasts.at(-1)?.title).toBe("Connection lost — waiting for the saloon…");

    h.recovery.onTransportStatus("reconnected");
    expect(h.store.getState().connected).toBe(true);
    expect(h.sent).toEqual([{ type: "room:join", code: "TESTY" }]); // code = seat authority: rebind
    expect(h.toasts.at(-1)?.title).toBe("Back online — resyncing the table…");

    h.ack({ ok: true });
    h.apply(snapshotEvent(0)); // catch-up answers the rebind
    await tick();
    expect(h.sent).toHaveLength(1);
    h.unsubscribe();
  });

  it("the first transport \"connected\" status never rejoins (initial connect is not recovery)", () => {
    const h = new Harness();
    h.recovery.onTransportStatus("connected");
    expect(h.store.getState().connected).toBe(true);
    expect(h.sent).toHaveLength(0);
    expect(h.toasts).toHaveLength(0);
    h.unsubscribe();
  });

  it("reconnected outside any room just restores connected — no join, no toast spam", () => {
    const h = new Harness();
    h.recovery.onTransportStatus("reconnected");
    expect(h.store.getState().connected).toBe(true);
    expect(h.sent).toHaveLength(0);
    h.unsubscribe();
  });
});
