"use client";

import { useEffect, useState } from "react";

/**
 * The two-mode breakpoint (STR/05 §1):
 *   "mobile"  → rail + wings layout (phones + portrait tablets, < 1024px)
 *   "desktop" → oval table layout (≥ 1024px, pointer-optimized)
 */
export type ViewportMode = "mobile" | "desktop";

export const DESKTOP_MIN_WIDTH = 1024;

export function useViewportMode(): ViewportMode {
  const [mode, setMode] = useState<ViewportMode | null>(null);
  useEffect(() => {
    const mq = window.matchMedia(`(min-width: ${DESKTOP_MIN_WIDTH}px)`);
    const update = () => setMode(mq.matches ? "desktop" : "mobile");
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  // Before first client effect: neutral, callers render nothing stage-flashing.
  return mode ?? "mobile";
}
