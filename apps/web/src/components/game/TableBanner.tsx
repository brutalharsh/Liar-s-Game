"use client";

import { motion } from "motion/react";
import { useGameStore } from "@/store/game";
import { rankWord } from "@/lib/format";

const SUIT: Record<string, string> = { K: "♠", Q: "♥", A: "♦" };

/** The 40px table-card banner (text version of the felt strip). */
export function TableBanner() {
  const tableCard = useGameStore((s) => s.tableCard);
  const roundNo = useGameStore((s) => s.roundNo);
  const phase = useGameStore((s) => s.phase);
  const roundEnd = useGameStore((s) => s.roundEnd);
  const shot = useGameStore((s) => s.shot);

  if (phase === "round-end" && roundEnd) {
    return (
      <motion.span
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="font-display text-sm tracking-widest text-brass"
      >
        ⏳ {roundEnd.reason.toUpperCase()}
      </motion.span>
    );
  }

  if (phase === "shot" && shot) {
    return (
      <span className="font-display text-sm tracking-widest text-blood-bright">
        {shot.kind === "EXECUTE" ? "EXECUTION" : "SELF-ROULETTE"} — ROUND {roundNo}
      </span>
    );
  }

  if (!tableCard) {
    return <span className="font-body text-xs text-ink-dim">shuffling…</span>;
  }

  return (
    <span className="flex items-center gap-2 font-display text-base tracking-widest text-ivory">
      <span aria-hidden className="text-xl text-lamp">
        {SUIT[tableCard]}
      </span>
      TABLE CARD {rankWord(tableCard)} · ROUND {roundNo}
    </span>
  );
}

export function ContextRibbon() {
  const pile = useGameStore((s) => s.pile);
  const window_ = useGameStore((s) => s.window);
  const tableCard = useGameStore((s) => s.tableCard);
  const phase = useGameStore((s) => s.phase);
  const reveal = useGameStore((s) => s.reveal);
  const turnSeat = useGameStore((s) => s.turnSeat);
  const nicknameOf = useGameStore((s) => s.nicknameOf);

  if (phase === "reveal" && reveal) {
    return <span>REVEALING {nicknameOf(reveal.seat)}'S LAST PLAY…</span>;
  }

  if (window_ && phase === "window") {
    return (
      <span>
        CHECK WINDOW OPEN — CHALLENGE {nicknameOf(window_.playSeat)}
        {"'S"} CLAIM?
      </span>
    );
  }

  if (pile.length > 0 && tableCard) {
    const last = pile[pile.length - 1];
    if (last) {
      const name = last.seat === 0 ? "YOU" : nicknameOf(last.seat);
      return (
        <span>
          {name} THREW {last.count} AS {rankWord(tableCard)}{(last.count === 1 ? "" : "S")}
          {turnSeat === 0 && " — YOUR CALL"}
        </span>
      );
    }
  }

  if (phase === "turn" && turnSeat !== null) {
    return <span>{turnSeat === 0 ? "YOUR THROW" : `${nicknameOf(turnSeat)} IS THINKING…`}</span>;
  }

  return <span>WAITING FOR THE SHOE…</span>;
}
