"use client";

import { useCountdown } from "@/hooks/useCountdown";
import { useGameStore } from "@/store/game";
import { formatClock } from "@/lib/format";

/** Top strip (36px mobile / 48px desktop): leave, room name + round, timer. */
export function TableTopStrip({ code, onLeave }: { code: string; onLeave: () => void }) {
  const roomName = useGameStore((s) => s.lobby?.name ?? "LIAR'S TABLE");
  const roundNo = useGameStore((s) => s.roundNo);
  const phase = useGameStore((s) => s.phase);
  const deadlineTs = useGameStore((s) => s.deadlineTs);
  const window_ = useGameStore((s) => s.window);
  const { secondsLeft, urgent } = useCountdown(window_?.closesAtTs ?? deadlineTs);
  const showTimer = phase === "turn" || phase === "window";

  return (
    <div className="flex min-h-12 items-center gap-2 border-b-2 border-wood-mid/70 bg-wood/85 px-3 pt-safe">
      <button
        onClick={onLeave}
        aria-label="Leave table"
        className="flex h-12 w-12 items-center justify-center rounded-full font-display text-xl text-ink-dim hover:bg-wood hover:text-blood-bright"
      >
        ←
      </button>
      <span className="truncate font-display text-sm tracking-wider text-ivory">
        {roomName} · R{roundNo || 1}
      </span>
      <span className="ml-auto font-body text-[10px] text-ink-dim">{code}</span>
      {showTimer && (
        <span
          aria-live="off"
          className={`rounded-btn border-2 px-2 py-0.5 font-display text-sm ${
            urgent ? "border-blood-bright bg-blood/20 text-blood-bright" : "border-lamp/60 bg-lamp/10 text-lamp"
          }`}
        >
          ⏱ {formatClock(secondsLeft)}
        </span>
      )}
    </div>
  );
}
