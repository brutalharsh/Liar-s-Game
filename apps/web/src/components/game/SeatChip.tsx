"use client";

import { useEffect, useState } from "react";
import type { SeatView } from "@/lib/wire";
import { Avatar } from "@/components/ui/Avatar";
import { useGameTable } from "@/components/game/gameTableContext";
import { EMOTE_PRESETS } from "@/lib/mock/emotes";
import { useGameStore } from "@/store/game";
import { useSettingsStore } from "@/store/settings";

const chipBase: Record<string, string> = {
  rail: "w-[86px] max-[370px]:w-[78px]",
  wing: "w-[92px] max-[370px]:w-[86px]",
  oval: "w-[112px] lg:w-[132px]",
  hero: "w-auto",
};

const avatarSize: Record<string, "xs" | "sm" | "md" | "lg"> = {
  rail: "sm",
  wing: "md",
  oval: "lg",
  hero: "lg",
};

function EmoteBubble({ seatNo }: { seatNo: number }) {
  const emote = useGameStore((s) => s.emotes[seatNo] ?? null);
  const emoteMuted = useSettingsStore((s) => s.emoteMuted);
  const [, tick] = useState(0);
  useEffect(() => {
    if (!emote) return;
    const t = setInterval(() => tick((n) => n + 1), 500);
    return () => clearInterval(t);
  }, [emote]);
  if (!emote || emoteMuted) return null;
  const age = Date.now() - emote.at;
  if (age > 2200) return null; // float ~2s then fade (research/09 §5)
  const preset = EMOTE_PRESETS.find((p) => p.id === emote.emoteId);
  return (
    <span
      className="absolute -top-9 left-1/2 z-20 -translate-x-1/2 whitespace-nowrap rounded-full border-2 border-brass-deep bg-wood-deep px-2 py-1 font-body text-[11px] text-ivory shadow-panel"
      role="img"
      aria-label={preset?.label ?? "emote"}
    >
      {preset?.emoji} {preset?.label}
    </span>
  );
}

/** One seat anywhere on the table: rail chip / wing chip / oval chip. */
export function SeatChip({
  seat,
  place,
  relation,
}: {
  seat: SeatView;
  place: "rail" | "wing" | "oval" | "hero";
  relation?: "prev" | "next";
}) {
  const { variant, onSeatTap } = useGameTable();
  const turnSeat = useGameStore((s) => s.turnSeat);
  const empty = seat.nickname === null;

  const isTurn = turnSeat === seat.seat && variant === "table" && !empty;
  const dead = !seat.alive && variant === "table" && !empty;

  const wings = place === "wing";
  const relationTag =
    wings && relation === "prev"
      ? "YOU CAN CALL"
      : wings && relation === "next"
        ? "CAN CALL YOU"
        : null;

  return (
    <div className={`relative flex flex-col items-center gap-1 ${chipBase[place]}`}>
      <EmoteBubble seatNo={seat.seat} />
      <button
        type="button"
        onClick={() => onSeatTap?.(seat)}
        aria-label={
          empty
            ? `seat ${seat.seat + 1} empty`
            : `${seat.nickname}, seat ${seat.seat + 1}${dead ? ", eliminated" : ""}`
        }
        className={`relative flex flex-col items-center gap-1 rounded-btn border-2 px-1 pb-1 pt-2 transition-transform active:scale-95 ${
          empty
            ? "border-dashed border-ink-dim/30 bg-wood-deep/30"
            : isTurn
              ? "border-brass bg-wood/80"
              : "border-wood-mid/60 bg-wood/50"
        } ${dead ? "opacity-45 grayscale" : ""} ${wings ? "min-h-[76px]" : ""}`}
      >
        <span className={`relative ${isTurn ? "animate-spot-pulse rounded-full" : ""}`}>
          <Avatar spec={seat.avatar} size={avatarSize[place]} dimmed={!seat.connected} />
          {seat.isHost && (
            <span
              className="absolute -right-2 -top-2 text-sm"
              aria-label="host"
              title="Host"
            >
              👑
            </span>
          )}
          {seat.locked && (
            <span className="absolute -bottom-1 -left-2 text-xs" aria-label="seat locked" title="Locked">
              🔒
            </span>
          )}
          {seat.isBot && !seat.isHost && (
            <span className="absolute -bottom-1 -right-2 text-[10px]" aria-label="bot player" title="Bot">
              🤖
            </span>
          )}
        </span>
        <span className="flex h-4 items-center gap-1">
          <span className="max-w-[64px] truncate font-display text-[10px] tracking-wider text-ivory md:text-xs">
            {empty ? "+" : (seat.nickname ?? "—")}
          </span>
        </span>
      </button>

      {/* card count chip (table variant, post-deal) */}
      {variant === "table" && seat.cardCount !== null && !empty && (
        <span className="rounded-full bg-wood-deep px-1.5 font-display text-[10px] text-lamp">
          {seat.cardCount}c
        </span>
      )}

      {/* chamber pips (x/6) — mobile rail/wing dots, oval adds label */}
      {variant === "table" && !empty && (
        <span className={`flex flex-col items-center ${dead ? "opacity-60" : ""}`}>
          <ChamberPipsCompact pulled={seat.pulled} />
          {place === "oval" && (
            <span className="font-body text-[10px] text-ink-dim">
              {seat.pulled}/6 {dead && "🕯 RIP"}
            </span>
          )}
        </span>
      )}

      {relationTag && !empty && (
        <span
          className={`rounded-full px-1.5 py-px font-body text-[9px] uppercase tracking-wider ${
            relation === "prev" ? "bg-blood/25 text-blood-bright" : "bg-lamp/25 text-lamp"
          }`}
        >
          {relationTag}
        </span>
      )}

      {empty && variant === "lobby" && (
        <span className="font-body text-[10px] text-ink-dim">
          {seat.locked ? "LOCKED" : "INVITE"}
        </span>
      )}

      {!empty && !seat.connected && (
        <span className="font-body text-[9px] text-ink-dim italic">reconnecting…</span>
      )}
    </div>
  );
}

function ChamberPipsCompact({ pulled }: { pulled: number }) {
  return (
    <span className="flex gap-[3px]" aria-label={`${pulled} of 6 chambers used`}>
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <span
          key={i}
          aria-hidden
          className={`h-1.5 w-1.5 rounded-full ${
            i < pulled
              ? pulled >= 5
                ? "bg-blood-bright"
                : pulled >= 3
                  ? "bg-lamp"
                  : "bg-brass"
              : "bg-wood-mid/70"
          }`}
        />
      ))}
    </span>
  );
}
