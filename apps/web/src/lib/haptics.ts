"use client";

/**
 * Haptics (STR/05 §5 haptics map — mission-pinned patterns):
 *   throw 10ms · window arm 20ms · blank click 30ms · live bang [40,60,80]
 * Feature-detected `navigator.vibrate` (Chromium-only; Safari/Firefox ship
 * neither — graceful silence, never promised to iPhone users). Halved when
 * reduced-motion is on (research/09 §6).
 */

export type HapticPattern =
  | "throw" // 10
  | "window-arm" // 20
  | "deal" // [8,40,8]
  | "select" // 10
  | "your-turn" // 20
  | "challenge-confirm" // [30,50,30]
  | "cock" // 40
  | "blank" // 30
  | "live" // [40,60,80]
  | "win"; // [20,40,20,40,100]

const PATTERNS: Record<HapticPattern, number | number[]> = {
  throw: 10,
  "window-arm": 20,
  deal: [8, 40, 8],
  select: 10,
  "your-turn": 20,
  "challenge-confirm": [30, 50, 30],
  cock: 40,
  blank: 30,
  live: [40, 60, 80],
  win: [20, 40, 20, 40, 100],
};

function halve(pattern: number | number[]): number | number[] {
  if (typeof pattern === "number") return Math.max(1, Math.round(pattern / 2));
  return pattern.map((ms) => Math.max(1, Math.round(ms / 2)));
}

/** Fire-and-forget vibration; no-ops where the API is missing. */
export function vibrate(pattern: HapticPattern, reducedMotion = false): void {
  if (typeof navigator === "undefined" || typeof navigator.vibrate !== "function") return;
  try {
    navigator.vibrate(reducedMotion ? halve(PATTERNS[pattern]) : PATTERNS[pattern]);
  } catch {
    // vibrate() can throw on invalid input / lost gesture — haptics are sugar.
  }
}
