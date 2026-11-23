"use client";

import { AnimatePresence, motion } from "motion/react";
import type { PlayedStack } from "@/lib/wire";
import { useGameStore } from "@/store/game";
import { useGameTable } from "@/components/game/gameTableContext";
import { GameCard } from "@/components/game/GameCard";
import { Verdict } from "@/components/ui/Verdict";
import { rankWord } from "@/lib/format";

/**
 * Central played pile (research/09 §2.2): per-PLAYER mini stacks (≤3
 * overlapped card backs), each oriented toward its owner's seat; the last
 * throw gets a gold edge + floating claim label. Counts only — faces arrive
 * exclusively via reveal:show.
 */
export function PlayedPile() {
  const pile = useGameStore((s) => s.pile);
  const reveal = useGameStore((s) => s.reveal);
  const shot = useGameStore((s) => s.shot);
  const phase = useGameStore((s) => s.phase);
  const tableCard = useGameStore((s) => s.tableCard);
  const { orderedSeats, mode } = useGameTable();
  const order = new Map(orderedSeats.map((s, i) => [s.seat, i]));

  const sorted = [...pile].sort((a, b) => (order.get(a.seat) ?? 99) - (order.get(b.seat) ?? 99));
  const lastSeat = reveal?.seat ?? (sorted.length > 0 ? (sorted[sorted.length - 1] as PlayedStack).seat : null);

  return (
    <div className="flex max-w-full flex-col items-center gap-3">
      {reveal && (
        <div className="mb-1 flex flex-col items-center gap-3">
          <div className="flex gap-1">
            {reveal.cards.map((card, i) => (
              <motion.span
                key={card.id}
                initial={{ rotateY: 180 }}
                animate={{ rotateY: 0 }}
                transition={{ delay: i * 0.4, duration: 0.3 }}
                style={{ transformStyle: "preserve-3d" }}
              >
                <GameCard rank={card.rank} faceUp size={mode === "desktop" ? "md" : "sm"} />
              </motion.span>
            ))}
          </div>
          {phase === "reveal" || phase === "shot" || phase === "round-end" ? (
            <motion.div initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
              <Verdict verdict={reveal.verdict} size={mode === "desktop" ? "xl" : "md"} />
            </motion.div>
          ) : null}
        </div>
      )}

      {!reveal && sorted.length > 0 && (
        <div className="flex flex-col items-center gap-2">
          <div className="flex max-w-[260px] flex-wrap items-center justify-center gap-2 lg:max-w-[420px]">
            {sorted.map((stack) => {
              const isLast = stack.seat === lastSeat;
              return (
                <div
                  key={stack.seat}
                  className={`relative flex items-center ${isLast ? "-translate-y-1 scale-110" : "opacity-80"}`}
                >
                  {Array.from({ length: Math.min(stack.count, 3) }).map((_, i) => (
                    <span key={i} className={i > 0 ? "-ml-4" : ""}>
                      <GameCard faceUp={false} size={mode === "desktop" ? "sm" : "sm"} />
                    </span>
                  ))}
                  <span
                    className={`absolute -bottom-2 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full px-1.5 font-display text-[10px] ${
                      isLast ? "border border-brass bg-wood-deep text-brass" : "bg-wood-deep/80 text-ink-dim"
                    }`}
                  >
                    ×{stack.count}
                  </span>
                </div>
              );
            })}
          </div>
          {lastSeat !== null && tableCard && (
            <span className="rounded-full border border-brass-deep bg-wood-deep/90 px-2 py-0.5 font-body text-[11px] text-lamp">
              last play lives on the {rankWord(tableCard)} pile
            </span>
          )}
        </div>
      )}

      {reveal === null && sorted.length === 0 && phase !== "lobby" && (
        <span className="rounded-btn border-2 border-dashed border-ink-dim/30 px-4 py-2 font-body text-xs text-ink-dim/70">
          cards fly here
        </span>
      )}

      {/* shot strip — revolver finds its hand (cinematics land with W2/M1) */}
      {shot && (
        <AnimatePresence>
          <motion.div
            initial={{ y: 14, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ opacity: 0 }}
            className={`flex flex-col items-center gap-1 rounded-card border-2 px-4 py-2 text-center ${
              shot.outcome === "LIVE"
                ? "border-blood-bright bg-blood/15"
                : shot.outcome === "BLANK"
                  ? "border-verdict bg-verdict/10"
                  : "border-lamp bg-wood-deep/80"
            }`}
          >
            <span className="text-3xl" aria-hidden>
              🔫
            </span>
            <span className="font-display text-sm text-ivory">
              {shot.outcome === null
                ? "the cylinder spins…"
                : shot.outcome === "LIVE"
                  ? "✖ ELIMINATED"
                  : "✓ PHEW — SURVIVED"}
            </span>
            <span className="font-body text-[11px] text-ink-dim">
              {shot.kind === "EXECUTE"
                ? "executed by their accuser"
                : shot.outcome === "BLANK"
                  ? "click… no round in the chamber"
                  : "their own finger on the trigger"}
            </span>
          </motion.div>
        </AnimatePresence>
      )}
    </div>
  );
}
