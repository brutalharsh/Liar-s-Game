"use client";

import { motion } from "motion/react";
import { type ShotBeat } from "@/motion/shot";
import { revolverTransition } from "@/motion/shot";

/**
 * The revolver — pure CSS art (no image assets): barrel + cylinder with six
 * chamber pips + hammer + walnut grip. `spinning` runs the blur-spin beat;
 * `cocked` snaps the hammer. Tokens only (no hardcoded palette hex).
 */
export function Revolver({
  spinning,
  cocked,
  side,
  reduced,
}: {
  spinning: boolean;
  cocked: boolean;
  side: "self" | "left";
  reduced: boolean;
}) {
  return (
    <motion.div
      variants={revolverVariantsReduced(reduced)}
      initial="off"
      animate="mounted"
      transition={{ ...revolverTransition, duration: reduced ? 0 : revolverTransition.duration }}
      custom={side}
      className="relative mx-auto w-44"
      aria-hidden
    >
      {/* barrel */}
      <div className="relative h-8 w-44 rounded-r-md border-2 border-brass-deep/80 bg-wood-mid shadow-[inset_0_-4px_8px_color-mix(in_srgb,var(--color-wood-deep)_60%,transparent)]">
        <div className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-brass-deep" />
        <div className="absolute left-4 top-0 h-4 w-3 -translate-y-1/2 rounded-t-sm bg-wood-mid" />
      </div>

      {/* cylinder — the six chambers rotate for the spin */}
      <motion.div
        className="absolute left-[52px] top-[2px]"
        animate={spinning && !reduced ? "spin" : "rest"}
        variants={{
          rest: { rotate: 0, filter: "blur(0px)" },
          spin: { rotate: 1080, filter: ["blur(0px)", "blur(2.4px)", "blur(2.4px)", "blur(0px)"] },
        }}
        transition={{ duration: 1.2, ease: "easeIn" }}
      >
        <div className="relative h-14 w-14 rounded-full border-4 border-brass-deep/90 bg-wood-deep shadow-[inset_0_0_10px_color-mix(in_srgb,var(--color-wood-deep)_70%,transparent)]">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <span
              key={i}
              className="absolute left-1/2 top-1/2 h-2 w-2 rounded-full bg-ink-dim/50"
              style={{
                transform: `rotate(${i * 60}deg) translate(0, -19px)`,
                transformOrigin: "0 0",
              }}
            />
          ))}
          <div className="absolute inset-2 rounded-full border border-brass-deep/40" />
        </div>
      </motion.div>

      {/* hammer */}
      <motion.div
        className="absolute left-[104px] top-[-10px] h-5 w-7 rounded-sm border-2 border-brass-deep/80 bg-wood-mid"
        animate={cocked ? "cocked" : "rest"}
        variants={{
          rest: { y: 0, rotate: 0 },
          cocked: { y: -7, rotate: -14 },
        }}
        transition={{ duration: 0.08, ease: "easeIn" }}
      />

      {/* grip */}
      <div className="absolute left-[112px] top-[26px] h-16 w-9 -rotate-12 rounded-b-lg border-2 border-brass-deep/70 bg-wood shadow-[inset_0_-6px_10px_color-mix(in_srgb,var(--color-wood-deep)_55%,transparent)]">
        <div className="absolute inset-1 rounded-b-md border border-brass-deep/40" />
      </div>

      {/* trigger guard */}
      <div className="absolute left-[86px] top-[26px] h-9 w-8 rounded-b-full border-2 border-brass-deep/70" />
    </motion.div>
  );
}

function revolverVariantsReduced(reduced: boolean) {
  if (reduced) {
    return {
      off: { opacity: 0 },
      mounted: { opacity: 1 },
    };
  }
  return {
    off: (side: "self" | "left") => ({
      y: side === "self" ? 110 : 0,
      x: side === "left" ? -260 : 0,
      opacity: 0,
      rotate: side === "left" ? -8 : 0,
    }),
    mounted: { x: 0, y: 0, opacity: 1, rotate: 0 },
  };
}
