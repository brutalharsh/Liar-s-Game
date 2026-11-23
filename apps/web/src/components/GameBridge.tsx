"use client";

import { useEffect, useRef } from "react";
import { socket } from "@/lib/socket";
import { useGameStore } from "@/store/game";
import { useUiStore } from "@/store/ui";
import { useIdentityStore, ensureGuestToken } from "@/store/identity";
import { avatarSpecToWire, type ServerEvent } from "@/lib/wire";

/**
 * Wires the socket adapter to the game store + toasts. Swapping the adapter
 * (mock ↔ live) changes nothing else — every screen reads the store. Also
 * owns the seq-gap recovery: a skipped seq raises `needsSnapshot`, and this
 * bridge re-emits `room:join` — the server (and the mock) answer with a
 * fresh `lobby:state` snapshot (STR/07 §4 catch-up, S1 seam).
 */
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

  // seq-gap recovery — rejoin for the catch-up snapshot (S1 seam)
  useEffect(() => {
    let armed = false;
    const unsub = useGameStore.subscribe((state) => {
      if (!state.needsSnapshot || armed) return;
      armed = true;
      const code = state.lobby?.code;
      if (code) {
        useUiStore.getState().push({ title: "Resyncing the table…", tone: "info" });
        void socket.emit({ type: "room:join", code }).then(() => {
          armed = false;
        });
      } else {
        armed = false;
      }
    });
    return unsub;
  }, []);

  // Host's theme pack applies to the whole room (STR/05 §2 token swap)
  const roomTheme = useGameStore((s) => s.lobby?.theme ?? null);
  useEffect(() => {
    document.documentElement.dataset.theme = roomTheme ?? "saloon";
    document.documentElement.dataset.inRoom = roomTheme ? "1" : "0";
  }, [roomTheme]);

  return null;
}
