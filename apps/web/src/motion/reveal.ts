"use client";

/**
 * Motion library for the reveal cinematic (STR/05 §4, research/09 §3):
 * accused stack flips one-by-one 400ms apart, per-card ✓/✗ stamps, then the
 * verdict stamp scale-in + 400ms beat. All variants object-shaped so they can
 * be composed onto any framer-motion node and stay seek-safe (pure values,
 * noanim loops). Reduced-motion call sites pass duration 0.
 */

import type { Transition, Variants } from "motion/react";

/** 3D flip: back rotates in from 180°, preserving depth (research/09 §3). */
export const revealCardVariants: Variants = {
  hidden: { rotateY: 180, opacity: 0.4 },
  flipped: { rotateY: 0, opacity: 1 },
};

export const revealCardFaceVariants: Variants = {
  hidden: { opacity: 0 },
  flipped: { opacity: 1 },
};

/** Per-card stamp: ✓ valid / ✗ off-rank pops as its card lands. */
export const revealStampVariants: Variants = {
  hidden: { scale: 0, opacity: 0 },
  shown: { scale: [0, 1.35, 1], opacity: 1 },
  exit: { scale: 0.6, opacity: 0 },
};

/** Verdict slam — TRUTH/LIE scale-in + quick settle (colorblind-safe: icon+text). */
export const verdictVariants: Variants = {
  hidden: { scale: 0.4, opacity: 0, rotate: -6 },
  slammed: (delay) => ({ scale: [0.4, 1.28, 1], opacity: 1, rotate: 0 }),
  exit: { opacity: 0, y: -12 },
};

/** Loser nameplate slides under the verdict + red-edge glow. */
export const loserPlateVariants: Variants = {
  hidden: { y: 14, opacity: 0 },
  shown: { y: 0, opacity: 1 },
  exit: { opacity: 0 },
};

export const revealTossVariants: Variants = {
  hidden: { y: 90, opacity: 0, scale: 0.9 },
  tossed: { y: 0, opacity: 1, scale: 1 },
};

/** flip staggering: card i flips at i*400ms (STR/03 §5). */
export const flipDelay = (i: number): number => i * 0.4;

/** Verdict beat lands 400ms after the last flip. */
export const verdictDelay = (cardCount: number): number => cardCount * 0.4 + 0.2;

export const beatTransition: Transition = { duration: 0.3, ease: "easeOut" };
export const stampTransition: Transition = { duration: 0.25, ease: "backOut" };
export const verdictTransition: Transition = { duration: 0.35, ease: "backOut" };
