"use client";

import { useMemo } from "react";
import type { ReactNode } from "react";
import type { SeatView } from "@/lib/wire";
import { useViewportMode } from "@/hooks/useViewportMode";
import { GameTableProvider } from "@/components/game/gameTableContext";
import { MobileTableLayout } from "@/components/game/MobileTableLayout";
import { DesktopTableLayout } from "@/components/game/DesktopTableLayout";

export type TableMode = "auto" | "mobile" | "desktop";

export interface GameTableShellProps {
  /** All seats ascending by seat number; empty seats (nickname null) included. */
  seats: SeatView[];
  /** The viewer's seat. null = spectating (no hero chip). */
  heroSeat: number | null;
  mode?: TableMode;
  variant?: "lobby" | "table";
  topStrip?: ReactNode;
  contextRibbon?: ReactNode;
  pile?: ReactNode;
  banner?: ReactNode;
  bottomBar?: ReactNode;
  aside?: ReactNode;
  onSeatTap?: (seat: SeatView) => void;
}

/**
 * <GameTableShell> — THE two-mode table primitive (STR/05 §1, research/09 §2).
 *
 *   mobile  (portrait < 1024px): hero seat pinned bottom-centre, wing seats
 *            left = previous player ("can call them"), right = next player
 *            ("they can call you"), remaining seats stacked on the top rail.
 *            Modals are bottom sheets.
 *   desktop (≥ 1024px): true oval felt, you at 6 o'clock, opponents spread
 *            across the 9:00 → 3:00 arc, side panel for room info + log.
 *            Modals are dialogs.
 *
 * W2 fills these shells with live game events — everything is props-driven.
 */
export function GameTableShell(props: GameTableShellProps) {
  const {
    seats,
    heroSeat,
    mode = "auto",
    variant = "table",
    topStrip,
    contextRibbon,
    pile,
    banner,
    bottomBar,
    aside,
    onSeatTap,
  } = props;
  const viewportMode = useViewportMode();
  const resolvedMode = mode === "auto" ? viewportMode : mode;

  const ctx = useMemo(() => {
    const sorted = [...seats].sort((a, b) => a.seat - b.seat);
    const heroIdx = heroSeat === null ? -1 : sorted.findIndex((s) => s.seat === heroSeat);
    const ordered = heroIdx >= 0
      ? [...sorted.slice(heroIdx), ...sorted.slice(0, heroIdx)]
      : sorted;
    const prevSeat = ordered.length > 2 ? (ordered[ordered.length - 1] ?? null) : ordered.length === 2 ? (ordered[1] ?? null) : null;
    const nextSeat = ordered.length > 1 ? (ordered[1] ?? null) : null;
    return {
      mode: resolvedMode,
      variant,
      orderedSeats: ordered,
      heroSeat,
      prevSeat,
      nextSeat,
      onSeatTap,
    };
  }, [seats, heroSeat, resolvedMode, variant, onSeatTap]);

  const slots = { topStrip, contextRibbon, pile, banner, bottomBar, aside };

  return (
    <GameTableProvider value={ctx}>
      {resolvedMode === "mobile" ? (
        <MobileTableLayout {...slots} />
      ) : (
        <DesktopTableLayout {...slots} />
      )}
    </GameTableProvider>
  );
}
