"use client";

import { AnimatePresence, motion } from "motion/react";
import { useGameStore } from "@/store/game";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";
import { GameCard } from "@/components/game/GameCard";
import {
  beatTransition,
  loserPlateVariants,
  revealCardVariants,
  revealStampVariants,
  stampTransition,
  verdictDelay,
} from "@/motion/reveal";

/**
 * REVEAL — the suspense core (STR/03 §2, research/09 §3): the accused's last
 * play slides to center spotlight and flips one-by-one, 400ms apart, with a
 * per-card ✓/✗ stamp (colorblind-safe: ring shape + icon + nothing color-only),
 * then the verdict stamp TRUTH/LIE scale-in with a 400ms beat.
 * `reveal:show` is the ONLY event carrying faces — the components render
 * exactly those cards and nothing else.
 */
export function RevealStage() {
  const reveal = useGameStore((s) => s.reveal);
  const phase = useGameStore((s) => s.phase);
  const tableCard = useGameStore((s) => s.tableCard);
  const nicknameOf = useGameStore((s) => s.nicknameOf);
  const heroSeat = useGameStore((s) => s.heroSeat);
  const reduced = usePrefersReducedMotion();

  const visible = reveal !== null && (phase === "reveal" || phase === "shot");
  if (!reveal) return null;

  const accusedName = reveal.seat !== null ? nicknameOf(reveal.seat) : "The accused";
  const accusedIsYou = reveal.seat === heroSeat;
  const loserName = nicknameOf(reveal.loserSeat);
  const delayUnit = reduced ? 0 : 0.4;

  return (
    <AnimatePresence>
      {visible && phase === "reveal" && (
        <motion.div
          key={`${reveal.seat}-${reveal.verdict}-${reveal.cards.length}`}
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ ...beatTransition, duration: reduced ? 0 : 0.3 }}
          className="pointer-events-none fixed inset-x-0 top-[18%] z-50 flex flex-col items-center gap-3 px-4"
          aria-live="assertive"
        >
          <span className="rounded-full border-2 border-brass-deep bg-wood-deep/90 px-3 py-0.5 font-body text-[11px] text-ink-dim">
            {accusedIsYou ? "YOUR" : `${accusedName}'s`} last play — under the lamp
          </span>

          {/* the flips — 400ms stagger (STR/03 §5) */}
          <div className="flex items-center justify-center gap-2" style={{ perspective: 900 }}>
            {reveal.cards.map((card, i) => {
              const valid = card.rank === tableCard || card.rank === "J";
              return (
                <motion.div
                  key={card.id}
                  className="relative"
                  initial="hidden"
                  animate="flipped"
                  variants={revealCardVariants}
                  transition={{ ...beatTransition, delay: delayUnit * i, duration: reduced ? 0 : 0.3 }}
                >
                  <GameCard rank={card.rank} faceUp size="lg" label={card.rank === "J" ? "joker" : card.rank} />
                  {/* per-card stamp lands with its flip */}
                  <motion.span
                    className={`absolute -right-2 -top-2 flex h-7 w-7 items-center justify-center rounded-full border-2 text-sm font-bold ${
                      valid
                        ? "border-verdict bg-verdict text-ivory"
                        : "border-blood-bright bg-blood text-ivory"
                    }`}
                    initial="hidden"
                    animate="shown"
                    variants={revealStampVariants}
                    transition={{ ...stampTransition, delay: delayUnit * i + 0.18 }}
                    aria-label={valid ? "matches the table card" : "off-rank card"}
                  >
                    {valid ? "✓" : "✗"}
                  </motion.span>
                </motion.div>
              );
            })}
          </div>

          {/* verdict slam — TRUTH/LIE, icon + text (never color alone) */}
          <motion.div
            initial={{ scale: 0.4, opacity: 0, rotate: -6 }}
            animate={{ scale: [0.4, 1.28, 1], opacity: 1, rotate: 0 }}
            transition={{ duration: reduced ? 0 : 0.35, ease: "backOut", delay: reduced ? 0 : verdictDelay(reveal.cards.length) }}
            className={`rounded-btn border-4 px-8 py-3 font-display text-3xl tracking-widest md:text-4xl ${
              reveal.verdict === "TRUTH"
                ? "border-verdict bg-verdict/15 text-verdict"
                : "border-blood-bright bg-blood/20 text-blood-bright"
            }`}
          >
            <span aria-hidden>{reveal.verdict === "TRUTH" ? "✓" : "✗"}</span>{" "}
            {reveal.verdict === "TRUTH" ? "TRUTH!" : "LIAR!"}
          </motion.div>

          {/* loser nameplate — who faces the revolver */}
          <motion.div
            className="rounded-full border-2 border-blood-bright/70 bg-wood-deep/90 px-4 py-1 font-body text-xs text-ivory"
            initial="hidden"
            animate="shown"
            variants={loserPlateVariants}
            transition={{ ...beatTransition, delay: reduced ? 0 : verdictDelay(reveal.cards.length) + 0.1 }}
          >
            {reveal.loserSeat === heroSeat ? (
              <span className="text-blood-bright">YOU face the revolver — wrong is expensive</span>
            ) : (
              <span>
                <strong className="text-blood-bright">{loserName}</strong> takes the revolver
              </span>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
