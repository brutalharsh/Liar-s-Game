"use client";

import { useEffect } from "react";
import { motion } from "motion/react";
import { Button } from "@/components/ui/Button";
import { Sheet } from "@/components/ui/Sheet";
import { useGameStore } from "@/store/game";
import { pluralClaim } from "@/lib/format";
import { forcedPulseTransition, forcedPulseVariants } from "@/motion/table";
import { useCountdown } from "@/hooks/useCountdown";

/**
 * CONFIRM GUARD — accidental-challenge sheet (research/09 §3, STR/05 §3):
 * "Call SUE a LIAR? — she claims 2 KINGS." The target's name IS the guard,
 * the cost is stated ("wrong call = YOU take the gun"), ESC/cancel/5s
 * auto-dismiss. A sole-holder FORCED CALL renders with the urgent ribbon
 * and no confirm — the server fires that call itself (STR/01 §8).
 */
export function CallGuardSheet({
  open,
  onClose,
  accusedSeat,
}: {
  open: boolean;
  onClose: () => void;
  accusedSeat: number | null;
}) {
  const nicknameOf = useGameStore((s) => s.nicknameOf);
  const heroSeat = useGameStore((s) => s.heroSeat);
  const tableCard = useGameStore((s) => s.tableCard);
  const lastPlay = useGameStore((s) => s.lastPlay);
  const window_ = useGameStore((s) => s.window);
  const forcedCall = useGameStore((s) => s.forcedCall);
  const sendCheck = useGameStore((s) => s.sendCheck);

  const { secondsLeft } = useCountdown(window_?.closesAtTs ?? null);

  useEffect(() => {
    if (!open || forcedCall) return undefined;
    const t = setTimeout(onClose, 5000); // 5s auto-dismiss/cancel (research/09 §3)
    return () => clearTimeout(t);
  }, [open, forcedCall, onClose]);

  if (accusedSeat === null) return null;

  const name = accusedSeat === heroSeat ? "YOURSELF" : nicknameOf(accusedSeat);
  const count = lastPlay?.seat === accusedSeat ? lastPlay.count : 1;
  const claim = tableCard ? `${count} as ${pluralClaim(tableCard, count)}` : `${count} card${count === 1 ? "" : "s"}`;

  const confirm = async () => {
    const res = await sendCheck(accusedSeat);
    if (!res.ok) return; // guard stays open; the rejection toast arrives via `error`
    onClose();
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      dismissible={!forcedCall}
      title={forcedCall ? "FORCED CALL — last hand standing" : `Call ${name} a LIAR?`}
    >
      {forcedCall && (
        <motion.p
          className="mb-2 rounded-btn border-2 border-blood-bright bg-blood/15 px-3 py-2 text-center font-body text-xs text-blood-bright"
          initial="rest"
          animate="urgent"
          variants={forcedPulseVariants}
          transition={forcedPulseTransition}
        >
          Only one hand still holds cards — the rules call LIAR for you (STR/01 §8).
        </motion.p>
      )}
      <p className="mb-2 font-body text-base text-ivory">
        {name} claims <strong className="text-red-text">{claim}</strong>.
        {secondsLeft > 0 && window_ && (
          <em className="ml-1 not-italic font-body text-xs text-ink-dim">window closes in {Math.ceil(secondsLeft)}s</em>
        )}
      </p>
      <p className="mb-4 font-body text-sm text-ink-dim">
        Wrong call = <strong className="text-blood-bright">YOU</strong> face the revolver. Dead certain?
      </p>
      <div className="flex gap-3">
        <Button variant="outline" className="flex-1" onClick={onClose}>
          {forcedCall ? "WATCH IT PLAY" : "CANCEL"}
        </Button>
        {!forcedCall && (
          <Button variant="danger" className="flex-1" onClick={() => void confirm()}>
            YES, CALL LIAR
          </Button>
        )}
      </div>
    </Sheet>
  );
}
