"use client";

import { useEffect } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useGameStore } from "@/store/game";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";
import { vibrate } from "@/lib/haptics";
import { playSfx } from "@/lib/sfx";
import { emojiForSpec } from "@/lib/mock/avatar";
import { crownTransition, crownVariants, winnerCardVariants, winnerTransition } from "@/motion/table";
import { useCountUp } from "@/motion/useCountUp";
import { Button } from "@/components/ui/Button";

/**
 * GAME-OVER — the winner ceremony (STR/03 §4): winner crown drop + confetti
 * burst (reduced-motion: candles, no particles) + coins count-up + XP flash +
 * stats strip from the public match record + rematch CTA (host re-lobby,
 * everyone one-tap accepts — S1 seam; the mock simply re-runs).
 */
export function GameOverOverlay() {
  const phase = useGameStore((s) => s.phase);
  const gameOver = useGameStore((s) => s.gameOver);
  const heroSeat = useGameStore((s) => s.heroSeat);
  const nicknameOf = useGameStore((s) => s.nicknameOf);
  const seatByNumber = useGameStore((s) => s.seatByNumber);
  const rematch = useGameStore((s) => s.rematch);
  const reduced = usePrefersReducedMotion();

  const active = phase === "game-over" && gameOver !== null;

  // confetti burst (skipped for reduced-motion → candle row instead).
  // Colors are read from the live theme tokens — never hardcoded hex.
  useEffect(() => {
    if (!active || reduced) return undefined;
    vibrate("win", reduced);
    const css = getComputedStyle(document.documentElement);
    // live theme tokens only — a missing token falls back to confetti defaults
    const colors = ["--color-brass", "--color-lamp", "--color-ivory", "--color-blood-bright"]
      .map((token) => css.getPropertyValue(token).trim())
      .filter(Boolean);
    void (async () => {
      const confetti = (await import("canvas-confetti")).default;
      confetti({
        particleCount: 90,
        spread: 75,
        startVelocity: 42,
        origin: { y: 0.35 },
        ...(colors.length > 0 ? { colors } : {}),
        disableForReducedMotion: true,
      });
      setTimeout(() => {
        confetti({ particleCount: 60, angle: 60, spread: 60, origin: { x: 0, y: 0.5 }, ...(colors.length > 0 ? { colors } : {}), disableForReducedMotion: true });
        confetti({ particleCount: 60, angle: 120, spread: 60, origin: { x: 1, y: 0.5 }, ...(colors.length > 0 ? { colors } : {}), disableForReducedMotion: true });
      }, 350);
    })();
    return undefined;
  }, [active, reduced]);

  const myReward = gameOver?.rewards.find((r) => r.seat === heroSeat) ?? null;
  const myRecord = gameOver?.matchRecord.players.find((p) => p.seat === heroSeat) ?? null;
  const coins = myReward?.coins ?? 0;
  const xp = myReward?.xp ?? 0;
  const coinsShown = useCountUp(coins, active, 1200, reduced);
  const xpShown = useCountUp(xp, active, 1400, reduced);

  if (!gameOver) return null;
  const winnerSeat = gameOver.winnerSeat;
  const nobodySurvived = winnerSeat === null; // zero-survivor abort (STR/01 §7)
  const winnerName = nobodySurvived ? null : nicknameOf(winnerSeat);
  const iWon = !nobodySurvived && winnerSeat === heroSeat;
  const winnerEmoji = nobodySurvived ? "💀" : emojiForSpec(seatByNumber(winnerSeat)?.avatar ?? null);

  return (
    <AnimatePresence>
      {active && (
        <motion.div
          key={`go-${gameOver.matchRecord.matchId}`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reduced ? 0 : 0.4 }}
          className="fixed inset-0 z-[65] flex items-center justify-center bg-wood-deep/85 px-4 backdrop-blur-sm"
          aria-live="assertive"
          role="dialog"
          aria-label="Game over"
        >
          <motion.div
            className="relative flex w-full max-w-lg flex-col items-center gap-4 rounded-card border-4 border-brass bg-wood px-6 py-8 text-center shadow-panel"
            variants={winnerCardVariants}
            initial="off"
            animate="on"
            transition={winnerTransition}
          >
            {/* crown drop (skull when nobody survived) */}
            <motion.span
              className="text-6xl"
              initial={reduced ? { opacity: 0 } : "above"}
              animate={reduced ? { opacity: 1 } : "crowned"}
              variants={crownVariants}
              transition={reduced ? { duration: 0 } : crownTransition}
              aria-hidden
            >
              {nobodySurvived ? "💀" : "👑"}
            </motion.span>

            <p className="font-body text-xs uppercase tracking-widest text-lamp">
              {nobodySurvived ? "the room dissolves" : "last one standing"}
            </p>
            <h2 className="flex items-center gap-2 font-display text-3xl tracking-wider text-ivory">
              <span aria-hidden>{winnerEmoji}</span>{" "}
              {nobodySurvived ? "NOBODY SURVIVED" : `${winnerName} WINS`}
            </h2>
            {iWon && <p className="font-display text-sm text-brass">the table is yours — 🪙 {coinsShown} in your pocket</p>}

            {reduced ? (
              <p className="text-xl" aria-label="candles">🕯🕯🕯🕯</p>
            ) : null}

            {/* rewards reveal — coins count-up + XP flash (STR/03 §4) */}
            <div className="flex items-center gap-4 rounded-btn border-2 border-brass-deep bg-wood-deep/70 px-6 py-3">
              <span className="flex flex-col items-center">
                <span className="font-display text-2xl text-brass">🪙 {coinsShown}</span>
                <span className="font-body text-[10px] text-ink-dim">coins earned</span>
              </span>
              <span className="h-8 w-px bg-wood-mid" aria-hidden />
              <span className="flex flex-col items-center">
                <span className="font-display text-2xl text-lamp">✦ {xpShown}</span>
                <span className="font-body text-[10px] text-ink-dim">XP</span>
              </span>
              {myReward && myReward.unlockedTitles.length > 0 && (
                <>
                  <span className="h-8 w-px bg-wood-mid" aria-hidden />
                  <span className="flex flex-col items-center">
                    <span className="font-display text-base text-ivory">🎖 {myReward.unlockedTitles[0]}</span>
                    <span className="font-body text-[10px] text-ink-dim">title unlocked</span>
                  </span>
                </>
              )}
            </div>

            {/* stats strip — public match record only (STR/07 §3) */}
            {myRecord && (
              <ul className="grid w-full grid-cols-3 gap-2 sm:grid-cols-6">
                {(
                  [
                    ["kills", myRecord.stats.kills],
                    ["catches", myRecord.stats.catches],
                    ["bluffs", myRecord.stats.bluffSuccesses],
                    ["pulls", myRecord.stats.pullsSurvived],
                    ["rounds", myRecord.stats.roundsPlayed],
                    ["false calls", myRecord.stats.falseAccusations],
                  ] as const
                ).map(([label, value]) => (
                  <li key={label} className="flex flex-col rounded-btn border border-wood-mid bg-wood-deep/60 px-1 py-1.5">
                    <span className="font-display text-lg text-ivory">{value}</span>
                    <span className="font-body text-[9px] uppercase tracking-wider text-ink-dim">{label}</span>
                  </li>
                ))}
              </ul>
            )}

            <p className="font-body text-[11px] text-ink-dim">
              {gameOver.matchRecord.summary.rounds} rounds · {gameOver.matchRecord.summary.totalPulls} trigger pulls
            </p>

            {/* rematch CTA — host re-lobby flow (STR/03 §4) */}
            <div className="mt-1 flex w-full flex-col gap-2">
              <Button variant="brass" size="big" className="w-full text-xl" onClick={() => void rematch()}>
                ⟳ REMATCH — BACK TO THE FELT
              </Button>
              <p className="font-body text-[10px] text-ink-dim">
                rematch re-lobbies the same roster — everyone one-tap accepts
              </p>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
