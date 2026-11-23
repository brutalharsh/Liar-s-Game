"use client";

import { AnimatePresence, motion } from "motion/react";
import type { PlayedStack } from "@/lib/wire";
import { useGameStore } from "@/store/game";
import { useGameTable } from "@/components/game/gameTableContext";
import { GameCard } from "@/components/game/GameCard";
import { stackPopTransition, stackPopVariants, throwVariants, throwTransition } from "@/motion/table";
import { pluralClaim } from "@/lib/format";

/**
 * Central played pile (research/09 §2.2): per-PLAYER mini stacks (≤3
 * overlapped card backs) kinds oriented toward their owner, each with an
 * owner nameplate + count chip; the last throw carries the gold edge +
 * claim label. COUNTS ONLY — faces arrive exclusively via `reveal:show`
 * (rendered by <RevealStage>), so no hidden rank can ever render here.
 */
export function PlayedPile() {
  const pile = useGameStore((s) => s.pile);
  const totalPile = useGameStore((s) => s.totalPile);
  const tableCard = useGameStore((s) => s.tableCard);
  const lastPlay = useGameStore((s) => s.lastPlay);
  const phase = useGameStore((s) => s.phase);
  const heroSeat = useGameStore((s) => s.heroSeat);
  const nicknameOf = useGameStore((s) => s.nicknameOf);
  const forcedCall = useGameStore((s) => s.forcedCall);
  const { orderedSeats } = useGameTable();
  const order = new Map(orderedSeats.map((s, i) => [s.seat, i]));

  const sorted = [...pile].sort((a, b) => (order.get(a.seat) ?? 99) - (order.get(b.seat) ?? 99));
  const lastSeat = lastPlay?.seat ?? null;

  return (
    <div className="flex max-w-full flex-col items-center gap-3">
      {sorted.length > 0 && (
        <div className="flex max-w-[300px] flex-wrap items-end justify-center gap-3 lg:max-w-[440px]">
          <AnimatePresence initial={false}>
            {sorted.map((stack) => {
              const isLast = stack.seat === lastSeat;
              const name = stack.seat === heroSeat ? "YOU" : nicknameOf(stack.seat);
              return (
                <motion.div
                  key={`${stack.seat}-${stack.count}`}
                  initial={stack.seat === heroSeat && isLast ? "hand" : "off"}
                  animate="on"
                  variants={
                    stack.seat === heroSeat && isLast
                      ? throwVariants
                      : stackPopVariants
                  }
                  transition={stack.seat === heroSeat && isLast ? throwTransition : stackPopTransition}
                  className={`relative flex flex-col items-center ${isLast ? "-translate-y-1 scale-110" : "opacity-80"}`}
                >
                  <div className="flex items-center">
                    {Array.from({ length: Math.min(stack.count, 3) }).map((_, i) => (
                      <span key={i} className={i > 0 ? "-ml-4" : ""}>
                        <GameCard faceUp={false} size="sm" />
                      </span>
                    ))}
                  </div>
                  {/* count chip — the ONLY data a played stack exposes */}
                  <span
                    className={`absolute -bottom-2 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full px-1.5 font-display text-[10px] ${
                      isLast ? "border border-brass bg-wood-deep text-red-text" : "bg-wood-deep/80 text-ink-dim"
                    }`}
                  >
                    ×{stack.count}
                  </span>
                  {/* owner nameplate */}
                  <span
                    className={`mt-2.5 max-w-[76px] truncate font-body text-[10px] ${
                      isLast ? "text-red-text" : "text-ink-dim"
                    }`}
                  >
                    {name}
                    {isLast && " · last throw"}
                  </span>
                  {isLast && name === "YOU" && (
                    <span className="font-body text-[9px] text-ink-dim/80">thrown blind — you know what's under there</span>
                  )}
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}

      {/* claim label under the last throw (implicit claim — STR/01 §3) */}
      {lastSeat !== null && tableCard && sorted.length > 0 && (
        <span className="rounded-full border border-brass-deep bg-wood-deep/90 px-2 py-0.5 font-body text-[11px] text-lamp">
          claims {lastPlay?.count} as {pluralClaim(tableCard, lastPlay?.count ?? 1)}
        </span>
      )}

      {/* table-wide total — the wire's authoritative pile count (never a
          locally-summed guess; rendered as a count chip like the stacks) */}
      {totalPile > 0 && (
        <span className="rounded-full border border-brass-deep bg-wood-deep/90 px-2 py-0.5 font-body text-[11px] text-lamp">
          on the table: {totalPile}
        </span>
      )}

      {sorted.length === 0 && phase !== "lobby" && (
        <span className="rounded-btn border-2 border-dashed border-ink-dim/30 px-4 py-2 font-body text-xs text-ink-dim/70">
          cards fly here
        </span>
      )}

      {forcedCall && sorted.length > 0 && (
        <span className="rounded-full border border-blood-bright bg-blood/15 px-2 py-0.5 font-body text-[10px] uppercase tracking-widest text-blood-bright">
          last hand standing — forced call is live
        </span>
      )}
    </div>
  );
}
