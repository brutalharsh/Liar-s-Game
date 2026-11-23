"use client";

/**
 * Motion library for the shot cinematic (STR/05 §4 table, research/09 §4):
 * the centerpiece. Timings are law — cylinder blur-spin 1.2s → hammer cock →
 * dead air → result fork:
 *   BLANK → dry click + Zimmermann head-fake (camera lurches toward a BANG
 *           that doesn't come) + relief beat
 *   LIVE  → muzzle flash 80ms · screen shake ±6px 400ms · slam-to-black
 *           ~150ms · slump + gray-out (PG-13, no gore)
 * EXECUTE variant: accuser's revolver slides in, target-lock reticle closes
 * on the loser, fear-tremor loop, same pull beat. Every beat ships a
 * reduced-motion short/instant alternate (shotScheduleShort).
 */

import type { Transition, Variants } from "motion/react";

export type ShotBeat =
  | "dim" // spotlight narrows, ambient ducks
  | "enter" // SELF: revolver rises + glides to the hand · EXECUTE: slides in from the accuser
  | "reticle" // target-lock rings shutter closed on the loser (EXECUTE)
  | "spin" // cylinder blur-spin
  | "cock" // hammer cock + stage zoom toward the seat
  | "air" // dead air — vignette to 85%, heartbeat
  | "hold" // waiting on shot:result (server decides, client just drips)
  | "dryclick" // BLANK begins
  | "fake" // head-fake lurch toward camera
  | "settle" // freeze mid-flinch, slow settle back
  | "flash" // LIVE begins — muzzle flash 80ms
  | "black" // slam to black ~150ms
  | "slump"; // gray-out slump

const B = {
  dim: 0,
  enter: 500,
  reticle: 700,
  spin: 1200,
  cock: 2400,
  air: 2550,
  hold: 2900,
} as const;

/** Build to the trigger-hold (~2.9s) then wait for `shot:result`. */
export const shotBuildSchedule: readonly { beat: ShotBeat; at: number }[] = [
  { beat: "dim", at: B.dim },
  { beat: "enter", at: B.enter },
  { beat: "reticle", at: B.reticle },
  { beat: "spin", at: B.spin },
  { beat: "cock", at: B.cock },
  { beat: "air", at: B.air },
  { beat: "hold", at: B.hold },
];

/** Reduced-motion: stepped text beats, no transforms/shake (research/09 §6). */
export const shotBuildScheduleShort: readonly { beat: ShotBeat; at: number }[] = [
  { beat: "dim", at: 0 },
  { beat: "enter", at: 200 },
  { beat: "reticle", at: 350 },
  { beat: "spin", at: 600 },
  { beat: "cock", at: 1300 },
  { beat: "air", at: 1500 },
  { beat: "hold", at: 1800 },
];

/** BLANK payoff: dry click → 600ms of silence → head-fake → relief (§4.1). */
export const blankSchedule: readonly { beat: ShotBeat; at: number }[] = [
  { beat: "dryclick", at: 0 },
  { beat: "fake", at: 600 },
  { beat: "settle", at: 1450 },
];

/** LIVE payoff: flash → shake 400ms → slam black 150ms → slump (§4.1). */
export const liveSchedule: readonly { beat: ShotBeat; at: number }[] = [
  { beat: "flash", at: 0 },
  { beat: "black", at: 90 },
  { beat: "slump", at: 260 },
];

// ── variants ────────────────────────────────────────────────────────────────

/** Stage dims to a narrow spotlight on the loser (research/09 §4.1 t=0). */
export const spotlightVariants: Variants = {
  off: { opacity: 0 },
  on: { opacity: 1 },
};

export const spotlightTransition: Transition = { duration: 0.35 };

/**
 * Revolver entrance:
 *  · SELF — rises from the center tray and glides up (research/09 t=0.6)
 *  · EXECUTE — slides in from the left edge accuser-side
 */
export const revolverVariants: Variants = {
  off: (side: "self" | "left") => ({
    y: side === "self" ? 110 : 0,
    x: side === "left" ? -260 : 0,
    opacity: 0,
    rotate: side === "left" ? -8 : 0,
  }),
  mounted: { x: 0, y: 0, opacity: 1, rotate: 0 },
};

export const revolverTransition: Transition = { duration: 0.6, ease: "easeOut" };

/** Cylinder blur-spin — 6 accelerating mechanical ticks, blur sprite (§4.1). */
export const cylinderVariants: Variants = {
  rest: { rotate: 0, filter: "blur(0px)" },
  spin: { rotate: 1080, filter: ["blur(0px)", "blur(3px)", "blur(3px)", "blur(0px)"] },
};

export const cylinderTransition: Transition = { duration: 1.2, ease: "easeIn" };

/** Hammer cock + stage zoom 1.06× toward the loser's seat (§4.1). */
export const hammerVariants: Variants = {
  rest: { y: 0, rotate: 0 },
  cocked: { y: -7, rotate: -14 },
};
export const hammerTransition: Transition = { duration: 0.08, ease: "easeIn" };

/** Dead air: vignette to 85%, stage pushes 1.06× in. */
export const airVariants: Variants = {
  off: { opacity: 0, scale: 1 },
  on: { opacity: 0.85, scale: 1.06 },
};
export const airTransition: Transition = { duration: 0.35 };

/** Zimmermann head-fake: hard flinch 150ms → freeze → slow slump-back (§4.1). */
export const headFakeVariants: Variants = {
  rest: { x: 0, rotate: 0, scale: 1 },
  lurch: { x: 0, y: 22, rotate: 6, scale: 1.14 },
  freeze: { y: 22, rotate: 6, scale: 1.14 },
  relief: { y: 0, rotate: 0, scale: 1 },
};
export const headFakeTransition: Transition = { duration: 0.15, ease: "easeIn" };
export const reliefTransition: Transition = { duration: 0.9, ease: "easeOut" };

/** Muzzle flash 80ms. */
export const flashVariants: Variants = {
  off: { opacity: 0, scale: 0.4 },
  bang: { opacity: 1, scale: 1.6 },
};
export const flashTransition: Transition = { duration: 0.08 };

/** Screen shake ±6px · 400ms. Reduced-motion call sites swap for a red vignette flash. */
export const shakeVariants: Variants = {
  rest: { x: 0, y: 0 },
  shake: { x: [0, -6, 6, -4, 4, -2, 0], y: [0, 4, -4, 3, -3, 2, 0] },
};
export const shakeTransition: Transition = { duration: 0.4 };

/** Slam to black ~150ms. */
export const blackVariants: Variants = {
  off: { opacity: 0 },
  slam: { opacity: 1 },
};
export const blackTransition: Transition = { duration: 0.15 };

/** Death: slump + gray-out, spotlight fades sepia (PG-13 — stylistic, no gore). */
export const slumpVariants: Variants = {
  alive: { rotate: 0, y: 0, filter: "grayscale(0) sepia(0)" },
  gone: { rotate: 9, y: 26, filter: "grayscale(0.85) sepia(0.28)" },
};
export const slumpTransition: Transition = { duration: 0.8, ease: "easeOut" };

/** Target-lock reticle: corner brackets shutter closed on the loser (EXECUTE). */
export const reticleVariants: Variants = {
  off: { opacity: 0, scale: 2.2 },
  locked: { opacity: 1, scale: 1 },
  tremor: (t) => ({ x: [0, 2, -2, 0] }),
};
export const reticleTransition: Transition = { duration: 0.4, ease: "easeOut" };

/** Fear-tremor loop on the target: 8Hz ±2px (research/09 §4.2 FEAR). */
export const fearTremorVariants: Variants = {
  rest: { x: 0 },
  tremble: { x: [0, 2, -2, 1, -1, 0], transition: { duration: 0.5, repeat: Infinity, repeatDelay: 0.08 } },
};

/** Pull-beat caption (reduced-motion text ladder: "CLICK." etc.). */
export const beatCaptionVariants: Variants = {
  off: { opacity: 0, y: 6 },
  on: { opacity: 1, y: 0 },
};
export const beatCaptionTransition: Transition = { duration: 0.18 };
