"use client";

import { socket, socketMode } from "@/lib/socket";
import type { ServerEvent } from "@/lib/wire";

/**
 * Shared room:join flow (STR/03 §1.2): emit the client action, then route by
 * the carry of the join's catch-up snapshot — still in lobby → /lobby, phase
 * already past lobby (a reconnected mid-match seat) → /table (STR/07 §4).
 * Both rooms + join use this so a code typed anywhere lands the same way.
 */

const SNAPSHOT_WAIT_MS = 3_000;

export interface JoinFlowOutcome {
  ok: boolean;
  /** Where a successful join navigates. */
  destination: "lobby" | "table";
  spectator: boolean;
  yourSeat: number | null;
  /** Raw snapshot phase observed alongside the ack (null if none in time). */
  snapshotPhase: string | null;
  errorCode?: string;
  errorMessage?: string;
}

/** One-shot lobby:state waiter for `code` — cancels itself after one hit. */
function nextSnapshot(code: string): Promise<string | null> {
  return new Promise((resolve) => {
    let settled = false;
    const off = socket.on((ev: ServerEvent) => {
      if (ev.event !== "lobby:state" || ev.payload.roomCode !== code) return;
      if (settled) return;
      settled = true;
      off();
      resolve(ev.payload.phase);
    });
    setTimeout(() => {
      if (settled) return;
      settled = true;
      off();
      resolve(null);
    }, SNAPSHOT_WAIT_MS);
  });
}

export async function joinRoomByCode(rawCode: string): Promise<JoinFlowOutcome> {
  const code = rawCode.toUpperCase();
  // The snapshot rides with (or right behind) the join — listen BEFORE emitting
  // so the mock (which pushes it synchronously inside the ack path) is caught too.
  const phasePromise = nextSnapshot(code);
  const res = await socket.emit({ type: "room:join", code });
  if (!res.ok) {
    return {
      ok: false,
      destination: "lobby",
      spectator: false,
      yourSeat: null,
      snapshotPhase: null,
      errorCode: res.errorCode,
      errorMessage: res.errorMessage,
    };
  }
  const snapshotPhase = (await phasePromise) ?? null;
  const reconnected = snapshotPhase !== null && snapshotPhase !== "lobby";
  return {
    ok: true,
    destination: reconnected ? "table" : "lobby",
    spectator: res.spectator ?? false,
    yourSeat: res.yourSeat ?? null,
    snapshotPhase,
  };
}

/** Friendly copy for the router's stable error codes (STR/07 §2 error). */
export interface JoinErrorCopy {
  title: string;
  sub?: string;
}

export function joinErrorCopy(errorCode?: string): JoinErrorCopy {
  switch (errorCode) {
    case "ROOM_NOT_FOUND":
      return { title: "No table with that code", sub: "Check the 5 characters — the room may have folded." };
    case "ROOM_FULL":
      return { title: "That table's packed", sub: "You can spectate from the rail until a seat opens." };
    case "ROOM_LOCKED":
      return { title: "The host locked the door", sub: "Ask them to unlock a seat for you." };
    case "RATE_LIMITED":
      return { title: "Easy on the door", sub: "Too many join attempts — wait ten minutes and try again." };
    case "AUTH_REQUIRED":
      return {
        title: "Login first",
        sub: socketMode() === "live" ? "The saloon checks ID at the door — sign in to play." : "Sessions land with the live saloon.",
      };
    case "VALIDATION":
      return { title: "Codes are 5 characters", sub: "A–Z and 2–9, no I/L/O/0/1." };
    default:
      return { title: "Couldn't join that room", sub: "Give it another shake." };
  }
}
