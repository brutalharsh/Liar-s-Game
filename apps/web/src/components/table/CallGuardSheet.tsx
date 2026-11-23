"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/Button";
import { Sheet } from "@/components/ui/Sheet";
import { useGameStore } from "@/store/game";
import { socket } from "@/lib/socket";
import { pluralClaim } from "@/lib/format";
import type { TableCardRank } from "@/lib/wire";

/**
 * Accidental-challenge guard (research/09 §3): "Call SUE a LIAR?" — the
 * target's name IS the guard. Cost stated, 5s auto-dismiss, ESC cancels.
 */
export function CallGuardSheet({
  open,
  onClose,
  accusedSeat,
  tableCard,
  count,
}: {
  open: boolean;
  onClose: () => void;
  accusedSeat: number | null;
  tableCard: TableCardRank | null;
  count: number;
}) {
  const nicknameOf = useGameStore((s) => s.nicknameOf);

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(onClose, 5000);
    return () => clearTimeout(t);
  }, [open, onClose]);

  const name = accusedSeat === null ? null : accusedSeat === 0 ? "YOU" : nicknameOf(accusedSeat);
  const claim = tableCard
    ? `${count} as ${pluralClaim(tableCard, count)}`
    : `${count} unknown cards`;

  const confirm = async () => {
    if (accusedSeat === null) return;
    const res = await socket.emit({ type: "liar:call", accusedSeat });
    if (!res.ok) return; // store doesn't change; error toast arrives via socket
    onClose();
  };

  return (
    <Sheet open={open} onClose={onClose} title={`Call ${name ?? "them"} a LIAR?`}>
      <p className="mb-2 font-body text-base text-ivory">
        {name} claims <strong className="text-brass">{claim}</strong>.
      </p>
      <p className="mb-4 font-body text-sm text-ink-dim">
        Wrong call = <strong className="text-blood-bright">YOU</strong> face the revolver. Dead
        certain?
      </p>
      <div className="flex gap-3">
        <Button variant="outline" className="flex-1" onClick={onClose}>
          CANCEL
        </Button>
        <Button variant="danger" className="flex-1" onClick={() => void confirm()}>
          YES, CALL LIAR
        </Button>
      </div>
    </Sheet>
  );
}
