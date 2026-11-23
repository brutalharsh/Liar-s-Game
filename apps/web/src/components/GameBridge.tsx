"use client";

import { useEffect, useRef } from "react";
import { socket, type SocketStatus } from "@/lib/socket";
import { useGameStore, type GameStore } from "@/store/game";
import { useUiStore, type ToastTone } from "@/store/ui";
import { useIdentityStore, ensureGuestToken } from "@/store/identity";
import { avatarSpecToWire, type ClientAction, type EmitResult, type ServerEvent } from "@/lib/wire";

/**
 * Wires the socket adapter to the game store + toasts. Swapping the adapter
 * (mock ↔ live) changes nothing else — every screen reads the store.
 *
 * RECOVERY MODEL (STR/03 §3 / STR/07 §4) — two triggers, one repair:
 *   1. seq gap: a skipped seq raises `needsSnapshot` in the store;
 *   2. transport: the live adapter reports "dropped"/"reconnected".
 * Both funnel into `createTransportRecovery`, whose one repair is re-emitting
 * `room:join` (single-flight). The room code is the seat authority, so the
 * rejoin rebinds the seat AND the server answers with a fresh `lobby:state`
 * catch-up snapshot whose seq supersedes every missed event — one snapshot,
 * never N replays. Recovery must rejoin on transport reconnect even without
 * a gap: a restored socket alone doesn't rebind the seat, and a silent server
 * (e.g. waiting on the hero's turn) would otherwise never flag the gap.
 */

export interface RecoveryDeps {
  /** Zustand-shaped store seam (the singleton in the app; any store in tests). */
  store: {
    getState: () => GameStore;
    subscribe: (listener: (state: GameStore) => void) => () => void;
  };
  /** The emit seam — usually `(action) => socket.emit(action)`. */
  emit: (action: ClientAction) => Promise<EmitResult>;
  /** Toast bus. */
  push: (toast: { title: string; tone: ToastTone }) => void;
}

export interface TransportRecovery {
  /** Call on every store change (subscribe wiring) — re-resyncs on a fresh gap flag. */
  onStoreChange(): void;
  /** Call with adapter status updates — manages `connected` + rejoins on reconnect. */
  onTransportStatus(status: SocketStatus): void;
  /** Detach — clears any in-flight guard (unsubscribe stays with the caller). */
  dispose(): void;
}

/**
 * The recovery controller — pure wiring over injected seams, so the
 * rejoin-once semantics are unit-testable without React.
 */
export function createTransportRecovery({ store, emit, push }: RecoveryDeps): TransportRecovery {
  let joinInFlight = false;

  const resync = (code: string, toast: boolean, title: string): void => {
    if (joinInFlight) return; // single-flight: rapid repeated gaps collapse into ONE join
    joinInFlight = true;
    if (toast) push({ title, tone: "info" });
    emit({ type: "room:join", code }).then(
      (res) => {
        joinInFlight = false;
        if (!res.ok) return; // rejected join: leave the flag raised — the next event retries (no hammer loop)
        // The ack can (a) race a fresh seq gap, or (b) arrive before the
        // catch-up snapshot does (packet order is the server's choice).
        // Re-check once — silently — so a still-raised flag never waits in
        // silence; the rejoin is idempotent server-side and the loop is
        // bounded (the snapshot's seq supersedes the flag).
        const { needsSnapshot, lobby } = store.getState();
        if (needsSnapshot && lobby?.code) resync(lobby.code, false, title);
      },
      () => {
        joinInFlight = false; // emit rejected (transport down): the next event retries
      },
    );
  };

  return {
    onStoreChange: () => {
      const { needsSnapshot, lobby } = store.getState();
      if (needsSnapshot && lobby?.code) resync(lobby.code, true, "Resyncing the table…");
    },
    onTransportStatus: (status) => {
      const g = store.getState();
      if (status === "dropped") {
        g.setConnected(false);
        push({ title: "Connection lost — waiting for the saloon…", tone: "bad" });
        return;
      }
      g.setConnected(true); // "connected" (first) and "reconnected" both mean a live transport
      if (status === "reconnected" && g.lobby?.code) resync(g.lobby.code, true, "Back online — resyncing the table…");
    },
    dispose: () => {
      joinInFlight = false;
    },
  };
}

export function GameBridge() {
  const prevRosterRef = useRef<Map<string, string> | null>(null);

  useEffect(() => {
    const push = useUiStore.getState().push;

    const diffRoster = (names: string[], code: string): void => {
      const roster = new Map(names.map((n, i) => [`${code}:${i}`, n]));
      const prev = prevRosterRef.current;
      if (prev && prev.size > 0) {
        const values = new Set(roster.values());
        for (const name of prev.values()) {
          if (!values.has(name)) push({ title: `${name} left — seat open`, tone: "info" });
        }
        const prevValues = new Set(prev.values());
        for (const name of values) {
          if (!prevValues.has(name)) push({ title: `${name} joined`, tone: "info" });
        }
      }
      prevRosterRef.current = roster;
    };

    const handleEvent = (ev: ServerEvent): void => {
      switch (ev.event) {
        case "lobby:state": {
          const room = ev.payload;
          diffRoster(
            room.seats.filter((s) => s.nickname).map((s) => s.nickname as string),
            room.roomCode,
          );
          break;
        }
        case "round:end": {
          push({
            title: ev.payload.reason === "death" ? "A round ends in death" : "Survived the roulette",
            sub: `+${ev.payload.survivorCoins} coins`,
            tone: "good",
          });
          break;
        }
        case "error":
          push({ title: ev.payload.message, tone: "bad" });
          break;
        default:
          break;
      }
      useGameStore.getState().applyEvent(ev);
    };

    const off = socket.on(handleEvent);

    const identity = useIdentityStore.getState();
    void socket
      .connect({
        guestToken: identity.guestToken || ensureGuestToken(),
        nickname: identity.nickname || undefined,
        avatarSpec: avatarSpecToWire(identity.avatar) ?? undefined,
      })
      .then(() => useGameStore.getState().setConnected(true))
      .catch(() => useUiStore.getState().push({ title: "Couldn't reach the saloon", tone: "bad" }));

    return () => {
      off();
    };
  }, []);

  // seq-gap + transport recovery (see the recovery model note above)
  useEffect(() => {
    const recovery = createTransportRecovery({
      store: useGameStore,
      emit: (action) => socket.emit(action),
      push: (toast) => useUiStore.getState().push(toast),
    });
    const unsubStore = useGameStore.subscribe(recovery.onStoreChange);
    const unsubStatus = socket.onStatus(recovery.onTransportStatus);
    recovery.onStoreChange(); // catch a gap flag raised before this effect mounted
    return () => {
      unsubStore();
      unsubStatus();
      recovery.dispose();
    };
  }, []);

  // Host's theme pack applies to the whole room (STR/05 §2 token swap)
  const roomTheme = useGameStore((s) => s.lobby?.theme ?? null);
  useEffect(() => {
    document.documentElement.dataset.theme = roomTheme ?? "saloon";
    document.documentElement.dataset.inRoom = roomTheme ? "1" : "0";
  }, [roomTheme]);

  return null;
}
