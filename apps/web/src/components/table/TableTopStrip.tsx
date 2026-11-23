"use client";

import { useCountdown } from "@/hooks/useCountdown";
import { useGameStore } from "@/store/game";
import { formatClock } from "@/lib/format";
import { socketMode } from "@/lib/socket";

/** Top strip: leave · room name + round · transport badge · turn/window timer. */
export function TableTopStrip({ code, onLeave }: { code: string; onLeave: () => void }) {
  const roomName = useGameStore((s) => s.lobby?.name ?? "LIAR'S TABLE");
  const roundNo = useGameStore((s) => s.roundNo);
  const phase = useGameStore((s) => s.phase);
  const deadlineTs = useGameStore((s) => s.deadlineTs);
  const window_ = useGameStore((s) => s.window);
  const turnSeat = useGameStore((s) => s.turnSeat);
  const heroSeat = useGameStore((s) => s.heroSeat);
  const { secondsLeft, urgent } = useCountdown(window_?.closesAtTs ?? deadlineTs);
  const showTimer = (phase === "turn" || phase === "window") && (window_ !== null || turnSeat !== null);

  return (
    <div className="flex min-h-12 items-center gap-2 border-b-2 border-wood-mid/70 bg-wood/85 px-3 pt-safe">
      <button
        type="button"
        onClick={onLeave}
        aria-label="Leave table"
        className="flex h-12 w-12 items-center justify-center rounded-full font-display text-xl text-ink-dim hover:bg-wood hover:text-blood-bright"
      >
        ←
      </button>
      <span className="truncate font-display text-sm tracking-wider text-ivory">
        {roomName} · R{roundNo || 1}
      </span>
      <span className="font-body text-[10px] text-ink-dim">{code}</span>
      <span
        className={`hidden rounded-full border px-1.5 py-px font-body text-[9px] uppercase tracking-widest sm:inline ${
          socketMode() === "mock"
            ? "border-lamp/50 text-lamp"
            : "border-verdict/60 text-verdict"
        }`}
        title="transport adapter — ?live=1 opts into the real server"
      >
        {socketMode() === "mock" ? "demo" : "live"}
      </span>
      {showTimer && (
        <span
          aria-live="off"
          className={`ml-auto rounded-btn border-2 px-2 py-0.5 font-display text-sm ${
            urgent
              ? "border-blood-bright bg-blood/20 text-blood-bright"
              : "border-lamp/60 bg-lamp/10 text-lamp"
          }`}
        >
          ⏱ {window_ && window_.playSeat !== heroSeat ? `CHECK ${formatClock(secondsLeft)}` : formatClock(secondsLeft)}
        </span>
      )}
    </div>
  );
}
