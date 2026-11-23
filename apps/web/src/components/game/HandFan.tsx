"use client";

import { useState } from "react";
import { motion } from "motion/react";
import { useGameTable } from "@/components/game/gameTableContext";
import { useGameStore, type HandCard } from "@/store/game";
import { GameCard } from "@/components/game/GameCard";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";

/**
 * Fanned 5-card hand with tap-toggle multi-select ≤3 (research/09 §3):
 * selected cards lift +8px, gold ring + ✓ badge; a 4th tap is hard-rejected
 * with a shake (stays only when reduced-motion clears transitions).
 */
export function HandFan({ disabled = false }: { disabled?: boolean }) {
  const { mode } = useGameTable();
  const hand = useGameStore((s) => s.hand);
  const selected = useGameStore((s) => s.selectedCardIds);
  const toggle = useGameStore((s) => s.toggleCardSelection);
  const clear = useGameStore((s) => s.clearSelection);
  const reduced = usePrefersReducedMotion();
  const [rejectTick, setRejectTick] = useState(0);

  const desktop = mode === "desktop";
  const size = desktop ? "lg" : "md";
  const overlap = desktop ? "-ml-16" : "-ml-3.5";
  const maxRotate = desktop ? 18 : 16;

  const onCardTap = (card: HandCard) => {
    if (disabled) return;
    const ok = toggle(card.id);
    if (!ok) setRejectTick((t) => t + 1); // 4th card → hard reject shake
  };

  if (hand.length === 0) {
    return (
      <div className="flex h-24 items-center justify-center font-body text-xs text-ink-dim/60">
        — no cards in hand —
      </div>
    );
  }

  const mid = (hand.length - 1) / 2;

  return (
    <div className="relative flex flex-col items-center gap-1">
      {selected.length > 0 && (
        <div className="flex items-center gap-3" aria-live="polite">
          <span className="rounded-full border border-brass bg-wood-deep px-3 py-1 font-body text-xs text-brass">
            {selected.length === 3 ? "3/3 selected — throw them" : `${selected.length} selected`}
          </span>
          <button onClick={clear} className="min-h-12 px-2 font-body text-xs text-ink-dim underline hover:text-ivory">
            CLEAR
          </button>
        </div>
      )}

      <motion.div
        key={`fan-${rejectTick}`}
        animate={rejectTick > 0 && !reduced ? { x: [0, -6, 6, -4, 0] } : { x: 0 }}
        transition={{ duration: 0.35 }}
        className="flex items-end justify-center pt-3"
      >
        {hand.map((card, i) => {
          const offset = i - mid;
          const isSelected = selected.includes(card.id);
          return (
            <motion.button
              key={card.id}
              type="button"
              aria-pressed={isSelected}
              aria-label={`Card ${i + 1}${isSelected ? ", selected" : ""}`}
              onClick={() => onCardTap(card)}
              animate={{ rotate: mid === 0 ? 0 : (offset * maxRotate) / mid, y: isSelected ? -8 : Math.abs(offset) * 4 }}
              transition={reduced ? { duration: 0 } : { type: "spring", stiffness: 320, damping: 24 }}
              className={`relative ${i > 0 ? overlap : ""} touch-manipulation ${disabled ? "opacity-50" : ""}`}
            >
              <GameCard
                rank={card.rank}
                faceUp
                size={size}
                selected={isSelected}
                label={card.rank === "JOKER" ? "joker" : card.rank}
              />
              {isSelected && (
                <motion.span
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="absolute -right-1.5 -top-1.5 flex h-6 w-6 items-center justify-center rounded-full border-2 border-wood-deep bg-brass font-display text-xs text-wood-deep"
                  aria-hidden
                >
                  ✓
                </motion.span>
              )}
            </motion.button>
          );
        })}
      </motion.div>
    </div>
  );
}
