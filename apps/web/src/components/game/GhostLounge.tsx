"use client";

import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";
import { useGameStore } from "@/store/game";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";
import { GhostIcon } from "@/components/ui/icons";

/**
 * GHOST LOUNGE (STR/03 §2 "DEAD", research/09 §4.3): the hero is out —
 * the table tints sepia (via data-ghost on the table root), hand + CHECK
 * are disabled, emote-only interaction. The banner shows once, minimizes
 * to a chip; dead seats stay visible for social proof.
 */
export function useGhostMode(): boolean {
  const heroSeat = useGameStore((s) => s.heroSeat);
  const hero = useGameStore((s) => s.seatByNumber(s.heroSeat));
  const spectator = useGameStore((s) => s.spectator);
  const phase = useGameStore((s) => s.phase);
  const inGame = phase !== "idle" && phase !== "lobby";
  if (!inGame) return false;
  if (spectator) return true;
  return heroSeat !== null && (hero?.alive === false);
}

export function GhostLounge() {
  const ghost = useGhostMode();
  const spectator = useGameStore((s) => s.spectator);
  const reduced = usePrefersReducedMotion();
  const [minimized, setMinimized] = useState(false);

  useEffect(() => {
    if (ghost) setMinimized(false);
  }, [ghost]);

  // dead hero vs table-viewer: a spectator was never "out" — different frame.
  const title = spectator ? "SPECTATING THE TABLE" : "YOU'RE OUT — SPECTATING";
  const sub = spectator
    ? "Watching from the rails — no seat, no hand, no says."
    : "Ghost lounge: watch the table, roast the living. Emotes only.";

  return (
    <AnimatePresence>
      {ghost && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 12 }}
          transition={reduced ? { duration: 0 } : { duration: 0.3 }}
          className="pointer-events-none fixed inset-x-0 bottom-2 z-[46] flex justify-center px-4"
          aria-live="assertive"
        >
          {minimized ? (
            <button
              type="button"
              onClick={() => setMinimized(false)}
              className="flex min-h-12 items-center gap-1 rounded-full border border-brass-deep bg-wood-deep/80 px-3 py-0.5 font-body text-[10px] text-ink-dim hover:text-ivory"
              aria-label="Reopen ghost lounge banner"
            >
              <GhostIcon size={12} /> ghost lounge — spectating · emotes only
            </button>
          ) : (
            <div className="pointer-events-auto flex items-center gap-3 rounded-card border-2 border-brass-deep bg-wood-deep/95 px-4 py-2 shadow-panel">
              <span className="text-lamp" aria-hidden>
                <GhostIcon size={22} />
              </span>
              <div className="font-body text-xs text-ink-dim">
                <p className="font-display text-sm tracking-wider text-brass">{title}</p>
                <p className="mt-0.5">{sub}</p>
              </div>
              <button
                type="button"
                onClick={() => setMinimized(true)}
                className="min-h-12 rounded-btn border border-ink-dim/50 px-3 font-display text-xs text-ink-dim hover:text-ivory"
                aria-label="Minimize ghost lounge banner"
              >
                OK
              </button>
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
