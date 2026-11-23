"use client";

import { createContext, useContext } from "react";
import type { SeatView } from "@/lib/wire";
import type { ViewportMode } from "@/hooks/useViewportMode";

export interface GameTableContextValue {
  mode: ViewportMode;
  variant: "lobby" | "table";
  /** seats rotated so index 0 === hero; turn order runs seat 0 → 1 → … → n-1 (ccw ring). */
  orderedSeats: SeatView[];
  heroSeat: number | null;
  /** previous player (hero may call them LIAR) */
  prevSeat: SeatView | null;
  /** next player (may call hero LIAR) */
  nextSeat: SeatView | null;
  onSeatTap?: (seat: SeatView) => void;
}

const GameTableContext = createContext<GameTableContextValue | null>(null);

export const GameTableProvider = GameTableContext.Provider;

export function useGameTable(): GameTableContextValue {
  const ctx = useContext(GameTableContext);
  if (!ctx) throw new Error("useGameTable must be used inside <GameTableShell>");
  return ctx;
}
