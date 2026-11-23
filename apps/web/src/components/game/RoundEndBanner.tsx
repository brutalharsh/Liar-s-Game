"use client";

import { AnimatePresence, motion } from "motion/react";
import { useGameStore } from "@/store/game";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";
import { roundEndTransition, roundEndVariants } from "@/motion/table";

/**
 * ROUND-END banner (STR/03 §2): why the round ended + mini stat toasts,
 * rides top-center for its 2s beat (the server advances to ROUND:NEW).
 */
export function RoundEndBanner() {
  const phase = useGameStore((s) => s.phase);
  const roundNo = useGameStore((s) => s.roundNo);
  const roundEnd = useGameStore((s) => s.roundEnd);
  const shot = useGameStore((s) => s.shot);
  const reveal = useGameStore((s) => s.reveal);
  const nicknameOf = useGameStore((s) => s.nicknameOf);
  const heroSeat = useGameStore((s) => s.heroSeat);
  const reduced = usePrefersReducedMotion();

  const active = phase === "round-end" && roundEnd !== null;
  if (!roundEnd) return null;

  const loserSeat = shot?.loserSeat ?? reveal?.loserSeat ?? null;
  const loserName = loserSeat !== null ? nicknameOf(loserSeat) : "Someone";
  const died = roundEnd.reason === "death";
  const myXp = roundEnd.xpEarned.find((x) => x.seat === heroSeat);

  return (
    <AnimatePresence>
      {active && (
        <motion.div
          key={`re-${roundEnd.reason}`}
          initial="off"
          animate="on"
          exit="off"
          variants={roundEndVariants}
          transition={{ ...roundEndTransition, duration: reduced ? 0 : roundEndTransition.duration }}
          className={`pointer-events-none fixed inset-x-0 top-14 z-[55] mx-auto flex w-fit max-w-[92vw] flex-col items-center gap-1 rounded-card border-2 px-6 py-3 text-center shadow-panel ${
            died ? "border-blood-bright bg-wood-deep" : "border-brass-deep bg-wood-deep"
          }`}
          aria-live="assertive"
        >
          <span className={`font-display text-lg tracking-widest ${died ? "text-blood-bright" : "text-brass"}`}>
            {died ? `☠ ${loserName} met the live round` : `✓ ${loserName} survives the click`}
          </span>
          <span className="font-body text-xs text-ink-dim">
            round {roundNo} closes · every roulette ends the round
          </span>
          <span className="flex flex-wrap items-center justify-center gap-2 font-body text-[11px]">
            {roundEnd.survivorCoins > 0 && (
              <span className="rounded-full border border-brass/60 px-2 py-0.5 text-brass">
                +{roundEnd.survivorCoins} 🪙 survivors
              </span>
            )}
            {(myXp?.xp ?? 0) > 0 && (
              <span className="rounded-full border border-lamp/60 px-2 py-0.5 text-lamp">+{myXp?.xp} XP</span>
            )}
          </span>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
