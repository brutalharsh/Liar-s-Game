import type { ReactNode } from "react";
import { useGameTable } from "@/components/game/gameTableContext";
import { SeatChip } from "@/components/game/SeatChip";
import { useGameStore } from "@/store/game";

/**
 * MOBILE PORTRAIT TABLE (research/09 §2.2a):
 *   top rail → wings (prev | pile | next) → banner strip → bottom bar.
 * Turn flow reads bottom → right wing → rail (right-to-left) → left wing.
 */
export function MobileTableLayout({
  topStrip,
  contextRibbon,
  pile,
  banner,
  bottomBar,
}: {
  topStrip?: ReactNode;
  contextRibbon?: ReactNode;
  pile?: ReactNode;
  banner?: ReactNode;
  bottomBar?: ReactNode;
  aside?: ReactNode; // desktop-only panel; intentionally unused on mobile
}) {
  const { orderedSeats, prevSeat, nextSeat, variant, heroSeat: heroSeatNo } = useGameTable();
  const starterSeat = useGameStore((s) => s.starterSeat);
  const hero = orderedSeats[0] ?? null;
  const others = orderedSeats.slice(1);
  // rail: everyone except the two wings, laid out right-to-left per the
  // bottom → right wing → rail → left wing turn flow (research/09 §2.2a)
  const rail = others
    .filter((s) => s.seat !== nextSeat?.seat)
    .filter((s) => others.length <= 2 || s.seat !== prevSeat?.seat)
    .reverse();

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      {topStrip}

      {contextRibbon && (
        <div className="flex min-h-9 items-center justify-center bg-wood/90 px-3 text-center font-body text-xs text-ink-dim">
          {contextRibbon}
        </div>
      )}

      {/* stage: rail + wings + pile */}
      <div className="stage-felt relative min-h-0 flex-1">
        {/* top rail — remaining seats, worst case 7 players = 4 chips (wraps at 8+) */}
        {rail.length > 0 && (
          <div className="absolute inset-x-1 top-1 z-10 flex flex-wrap justify-center gap-1.5">
            {rail.map((seat) => (
              <SeatChip key={seat.seat} seat={seat} place="rail" />
            ))}
          </div>
        )}

        {/* wings flank the felt (2p: sole opponent renders right-only) */}
        <div className="absolute inset-y-[24%] left-1 z-10 flex items-center">
          {others.length > 1 && prevSeat && <SeatChip seat={prevSeat} place="wing" relation="prev" />}
        </div>
        <div className="absolute inset-y-[24%] right-1 z-10 flex items-center">
          {others.length > 1 && nextSeat && <SeatChip seat={nextSeat} place="wing" relation="next" />}
          {others.length === 1 && nextSeat && <SeatChip seat={nextSeat} place="wing" />}
        </div>

        {hero && <div className="sr-only">You: {hero.nickname}</div>}

        {/* center: played pile / lobby panel */}
        <div className="absolute inset-x-[22%] inset-y-[16%] flex items-center justify-center">
          {pile}
        </div>
      </div>

      {/* 40px table banner strip (round + table card) */}
      {banner && (
        <div className="flex min-h-10 items-center justify-center gap-2 border-y-2 border-wood-mid/70 bg-wood/85 px-3 py-1 text-center">
          {banner}
        </div>
      )}

      {/* bottom bar: hero strip + hand + action buttons (props-driven) */}
      {bottomBar && (
        <div className="relative px-safe pb-safe">
          {/* hero's round-starter marker — the hero has no seat chip on
              mobile, so the ★ first-throw badge (research/09 §2 seat cells)
              gets no surface from the shell; sink it onto the bottom bar */}
          {variant === "table" && heroSeatNo !== null && starterSeat === heroSeatNo && (
            <span
              aria-hidden="true"
              className="absolute -top-3 left-1/2 z-20 -translate-x-1/2 whitespace-nowrap rounded-full border border-brass-deep bg-wood-deep px-1.5 font-body text-[10px] uppercase tracking-widest text-brass shadow-panel"
            >
              ★ you throw first
            </span>
          )}
          {bottomBar}
        </div>
      )}
    </div>
  );
}
