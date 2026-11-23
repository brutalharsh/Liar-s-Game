"use client";

import { useEffect, useRef } from "react";
import { socket } from "@/lib/socket";
import { useGameStore } from "@/store/game";
import { useUiStore } from "@/store/ui";
import { useIdentityStore, ensureGuestToken } from "@/store/identity";
import type { LobbySnapshot, ServerEvent } from "@/lib/wire";

/**
 * Wires the (currently mock) socket adapter to the game store + toasts.
 * Swapping `socket` for the real socket.io-client adapter changes nothing
 * else — every screen reads the store.
 */
export function GameBridge() {
  const prevRosterRef = useRef<Map<string, string> | null>(null);

  useEffect(() => {
    const push = useUiStore.getState().push;

    const diffRoster = (lobby: LobbySnapshot): void => {
      const roster = new Map<string, string>();
      for (const seat of lobby.seats) {
        if (seat.nickname) roster.set(`${lobby.code}:${seat.seat}`, seat.nickname);
      }
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
      switch (ev.type) {
        case "lobby:state":
          diffRoster(ev.lobby);
          break;
        case "round:end":
          push({ title: ev.reason, sub: `+${ev.survivorCoins} coins · +${ev.xpEarned} XP`, tone: "good" });
          break;
        case "error":
          push({ title: ev.message, tone: "bad" });
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
        avatarSpec: identity.avatar,
      })
      .then(() => useGameStore.getState().setConnected(true))
      .catch(() => useUiStore.getState().push({ title: "Couldn't reach the saloon", tone: "bad" }));

    return () => {
      off();
    };
  }, []);

  // Host's theme pack applies to the whole room (STR/05 §2 token swap).
  const roomTheme = useGameStore((s) => s.lobby?.theme ?? null);
  useEffect(() => {
    document.documentElement.dataset.theme = roomTheme ?? "saloon";
    document.documentElement.dataset.inRoom = roomTheme ? "1" : "0";
  }, [roomTheme]);

  return null;
}
