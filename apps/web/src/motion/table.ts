"use client";

/**
 * Table-level motion (STR/05 §4 inventory): deal cascade, throw arc,
 * round-end banner, winner ceremony, stamps. GPU transforms only; every
 * animation has a reduced-motion instant/short alternate handled by call
 * sites passing duration 0 transitions.
 */

import type { Transition, Variants } from "motion/react";

/** Deal: cards slide from the shoe to each seat — 600ms total stagger. */
export const dealVariants: Variants = {
  shoe: { y: 120, opacity: 0, rotate: -4 },
  hand: { y: 0, opacity: 1, rotate: 0 },
};
export const dealTransition: Transition = { duration: 0.28, ease: "easeOut" };
export const dealStaggerMs = 70; // 5 cards ≈ 600ms total (STR/03 §5)

/** Throw: arc from the hand into the pile + settle — 400ms. */
export const throwVariants: Variants = {
  hand: { y: 180, scale: 0.85, opacity: 0.6 },
  pile: { y: 0, scale: 1, opacity: 1 },
};
export const throwTransition: Transition = { duration: 0.4, ease: "easeOut" };

/** Pile stack pop (last play lands with the gold edge). */
export const stackPopVariants: Variants = {
  off: { scale: 0.7, opacity: 0 },
  on: { scale: [0.7, 1.16, 1], opacity: 1 },
};
export const stackPopTransition: Transition = { duration: 0.3, ease: "backOut" };

/** Round-end banner slide + coins/xp toasts (2s). */
export const roundEndVariants: Variants = {
  off: { y: -24, opacity: 0 },
  on: { y: 0, opacity: 1 },
};
export const roundEndTransition: Transition = { duration: 0.35, ease: "easeOut" };

/** Win: crown drop + reward count-up reveals (4s ceremony). Gravity fall
 *  (easeIn) with a small recoil-settle — a physical drop, not a scale-pop. */
export const crownVariants: Variants = {
  above: { y: -140, opacity: 0, rotate: -18, scale: 1.6 },
  crowned: { y: [-140, 0, -10, 0], opacity: [0, 1, 1, 1], rotate: [-18, 0, 0, 0], scale: [1.6, 1, 1, 1] },
};
export const crownTransition: Transition = {
  duration: 0.85,
  times: [0, 0.68, 0.84, 1],
  ease: ["easeIn", "easeOut", "easeOut"],
};

export const winnerCardVariants: Variants = {
  off: { scale: 0.8, opacity: 0 },
  on: { scale: 1, opacity: 1 },
};
export const winnerTransition: Transition = { duration: 0.4, ease: "backOut" };

/** Toast pop (top-center, 3s). */
export const toastPopVariants: Variants = {
  off: { y: -12, opacity: 0, scale: 0.9 },
  on: { y: 0, opacity: 1, scale: [0.9, 1.06, 1] },
};
export const toastPopTransition: Transition = { duration: 0.3, ease: "backOut" };

/** SURVIVED / ELIMINATED stamps after the pull lands. */
export const shotStampVariants: Variants = {
  off: { scale: 0.5, opacity: 0 },
  on: { scale: [0.5, 1.3, 1], opacity: 1 },
};
export const shotStampTransition: Transition = { duration: 0.3, ease: "backOut" };

/** Forced-call ribbon pulse in the guard sheet. */
export const forcedPulseVariants: Variants = {
  rest: { opacity: 1 },
  urgent: { opacity: [1, 0.55, 1] },
};
export const forcedPulseTransition: Transition = { duration: 1.1, repeat: Infinity };
