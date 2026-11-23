"use client";

import type { CardRank } from "@/lib/wire";
import { rankWord } from "@/lib/format";

const RANK_SUIT: Record<string, { glyph: string; color: string; word: string }> = {
  K: { glyph: "♠", color: "text-wood-deep", word: "K" },
  Q: { glyph: "♥", color: "text-blood", word: "Q" },
  A: { glyph: "♦", color: "text-blood", word: "A" },
  J: { glyph: "★", color: "text-brass-deep", word: "J" },
};

/** A liar-deck card: face (rank known / reveal) or ornate back. */
export function GameCard({
  rank,
  faceUp,
  size = "md",
  selected = false,
  className = "",
  label,
}: {
  rank?: CardRank;
  faceUp: boolean;
  size?: "sm" | "md" | "lg";
  selected?: boolean;
  className?: string;
  label?: string;
}) {
  const dims = {
    sm: "h-[52px] w-9",
    md: "h-24 w-16 max-[500px]:h-[84px] max-[500px]:w-14",
    lg: "h-40 w-28",
  } as const;

  const rankInfo = rank ? RANK_SUIT[rank] : undefined;
  // face-up cards self-describe with their visible rank (label-in-name);
  // an explicit label (reveal stages) still wins
  const accessibleName = label ?? (faceUp && rank ? rankWord(rank) : undefined);

  return (
    <span
      role={accessibleName ? "img" : undefined}
      aria-label={accessibleName}
      className={`relative inline-flex shrink-0 select-none items-center justify-center rounded-card border-2 ${dims[size]} ${
        faceUp
          ? "border-wood-mid bg-ivory"
          : "card-back border-brass-deep/70"
      } ${selected ? "ring-4 ring-brass ring-offset-2 ring-offset-transparent" : ""} ${className}`}
    >
      {faceUp && rankInfo ? (
        <>
          <span className={`absolute left-1 top-0.5 font-display text-base leading-tight ${rankInfo.color}`}>
            {rankInfo.word}
          </span>
          <span className={`p-0 font-display text-3xl leading-none ${rankInfo.color}`} aria-hidden>
            {rankInfo.glyph}
          </span>
          <span
            className={`absolute bottom-0.5 right-1 rotate-180 font-display text-base leading-tight ${rankInfo.color}`}
            aria-hidden
          >
            {rankInfo.word}
          </span>
        </>
      ) : (
        <span className="font-display text-xl text-brass/40" aria-hidden>
          ✦
        </span>
      )}
    </span>
  );
}
