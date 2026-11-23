"use client";

import type { ReactNode } from "react";
import { useGameTable } from "@/components/game/gameTableContext";
import { SeatChip } from "@/components/game/SeatChip";

/**
 * Opponent clock angles across the 9:00 → 3:00 arc (research/09 §2.2c):
 * next player sits at 3:00, previous at 9:00, everything else evenly spaced.
 * n=1 → 12:00 (sole opponent is both prev & next). Hero always 6:00.
 */
function opponentAngles(n: number): number[] {
  if (n <= 0) return [];
  if (n === 1) return [90];
  return Array.from({ length: n }, (_, i) => (180 * i) / (n - 1));
}

/**
 * Opponents spread across the arc — x amplitude keeps the 9:00/3:00 chips
 * inside the felt at the tight `lg` layout (stage = viewport − 320px aside);
 * at 1024px that stage is 704px wide, so a 132px chip at x=6% (44 radius)
 * hung 24px off-screen, silently clipped by the route's overflow-hidden.
 */
function polarToPercent(angleDeg: number): { x: number; y: number } {
  const rad = (angleDeg * Math.PI) / 180;
  return {
    x: 50 + 38 * Math.cos(rad),
    y: 46 - 42 * Math.sin(rad),
  };
}

/**
 * DESKTOP OVAL TABLE (research/09 §2.2c): true oval felt, hero at 6 o'clock,
 * opponents around the rim, side panel (room info + event log), dialogs.
 */
export function DesktopTableLayout({
  topStrip,
  contextRibbon,
  pile,
  banner,
  bottomBar,
  aside,
}: {
  topStrip?: ReactNode;
  contextRibbon?: ReactNode;
  pile?: ReactNode;
  banner?: ReactNode;
  bottomBar?: ReactNode;
  aside?: ReactNode;
}) {
  const { orderedSeats, nextSeat } = useGameTable();
  const hero = orderedSeats[0] ?? null;
  const opponents = orderedSeats.slice(1);
  const angles = opponentAngles(opponents.length);
  const heroPos = polarToPercent(270); // 6 o'clock

  return (
    <div className="flex h-full min-h-0 overflow-hidden">
      <div className="relative flex min-w-0 flex-1 flex-col">
        {topStrip}

        {contextRibbon && (
          <div className="flex min-h-9 items-center justify-center bg-wood/90 px-3 text-center font-body text-xs text-ink-dim">
            {contextRibbon}
          </div>
        )}

        <div className="stage-felt relative min-h-0 flex-1">
          {/* the oval felt */}
          <div className="absolute left-1/2 top-1/2 h-[58%] w-[64%] -translate-x-1/2 -translate-y-1/2 rounded-[50%] border-[10px] border-wood bg-[radial-gradient(65%_65%_at_50%_45%,var(--color-felt),var(--color-felt-deep))] shadow-[inset_0_0_60px_color-mix(in_srgb,var(--color-wood-deep)_40%,transparent),0_30px_60px_color-mix(in_srgb,var(--color-wood-deep)_50%,transparent)]">
            <div className="absolute inset-2 rounded-[50%] border border-brass/15" aria-hidden />
          </div>

          {/* banner strip rides the top of the felt (table card + round) */}
          {banner && (
            <div className="absolute inset-x-0 top-1 z-20 flex justify-center">{banner}</div>
          )}

          {/* opponents around the rim — column centers floored at 88px so the
              ~142px-tall chip columns can never ride above the stage into the
              context ribbon (298px stage tops overlapped it 25–38px) */}
          {opponents.map((seat, i) => {
            const angle = angles[i] ?? 90;
            const pos = polarToPercent(angle);
            return (
              <div
                key={seat.seat}
                className="absolute z-10 -translate-x-1/2 -translate-y-1/2"
                style={{ left: `${pos.x}%`, top: `max(${pos.y}%, 88px)` }}
              >
                <SeatChip seat={seat} place="oval" relation={seat.seat === nextSeat?.seat ? "next" : undefined} />
              </div>
            );
          })}

          {/* hero at 6 o'clock */}
          {hero && (
            <div
              className="absolute z-10 -translate-x-1/2 -translate-y-1/2"
              style={{ left: `${heroPos.x}%`, top: `max(${heroPos.y}%, 88px)` }}
            >
              <SeatChip seat={hero} place="oval" relation={undefined} />
            </div>
          )}

          {/* center played pile */}
          <div className="absolute left-1/2 top-1/2 z-[5] max-h-[62%] w-[46%] -translate-x-1/2 -translate-y-1/2">
            <div className="flex items-center justify-center">{pile}</div>
          </div>
        </div>

        {bottomBar && <div className="px-safe pb-safe">{bottomBar}</div>}
      </div>

      {/* side panel — room info + event log (research/09 §2.2c desktop) */}
      {aside && (
        <aside className="hidden w-80 shrink-0 flex-col gap-3 overflow-y-auto border-l-2 border-wood-mid/60 bg-wood/40 p-4 lg:flex">
          {aside}
        </aside>
      )}
    </div>
  );
}
