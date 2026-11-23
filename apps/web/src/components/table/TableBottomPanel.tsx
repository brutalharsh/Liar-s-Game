"use client";

import { Avatar } from "@/components/ui/Avatar";
import { ChamberPips } from "@/components/game/ChamberPips";
import { HandFan } from "@/components/game/HandFan";
import { Button } from "@/components/ui/Button";
import { useGameStore } from "@/store/game";
import { useSettingsStore } from "@/store/settings";
import { socket } from "@/lib/socket";
import { rankWord } from "@/lib/format";
import type { TableCardRank } from "@/lib/wire";
import { useState } from "react";
import { EmoteWheel } from "@/components/game/EmoteWheel";

/**
 * Hero strip + fanned hand + THROW/CHECK controls (≥64px buttons).
 * THROW shows the live claim text ("THROW 2 AS KINGS"); CHECK is armed only
 * during an open window (stub states per STR/03 — W2 wires true legality).
 */
export function TableBottomPanel({
  canCheck,
  accusedSeat,
  tableCard,
  onCheck,
}: {
  canCheck: boolean;
  accusedSeat: number | null;
  tableCard: TableCardRank | null;
  onCheck: () => void;
}) {
  const heroSeat = 0;
  const seats = useGameStore((s) => s.lobby?.seats);
  const hero = seats?.find((s) => s.seat === heroSeat) ?? null;
  const selectedCount = useGameStore((s) => s.selectedCardIds.length);
  const pendingThrow = useGameStore((s) => s.pendingThrow);
  const turnSeat = useGameStore((s) => s.turnSeat);
  const phase = useGameStore((s) => s.phase);
  const window_ = useGameStore((s) => s.window);
  const setPendingThrow = useGameStore((s) => s.setPendingThrow);
  const clearSelection = useGameStore((s) => s.clearSelection);
  const emoteMuted = useSettingsStore((s) => s.emoteMuted);
  const [emoteOpen, setEmoteOpen] = useState(false);

  const myTurn = turnSeat === heroSeat;
  const throwLabel = () => {
    if (pendingThrow) return "WAIT…";
    if (!myTurn || phase !== "turn") return "WAIT — NOT YOUR TURN";
    if (selectedCount === 0) return "SELECT 1–3 CARDS";
    const rank = tableCard ? rankWord(tableCard) : "?";
    return `THROW ${selectedCount} AS ${rank}${selectedCount === 1 ? "" : "S"}`;
  };

  const doThrow = async () => {
    if (!myTurn || pendingThrow || selectedCount === 0) return;
    const cardIds = useGameStore.getState().selectedCardIds;
    setPendingThrow(true);
    const res = await socket.emit({ type: "play:cards", cardIds });
    if (!res.ok) {
      setPendingThrow(false);
    } else {
      clearSelection();
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-2 border-t-2 border-wood-mid/60 bg-wood/70 px-3 pt-2">
      {/* hero strip */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Avatar spec={hero?.avatar ?? null} size="md" />
          <span className="font-display text-lg text-ivory">{hero?.nickname ?? "YOU"}</span>
          {hero?.isHost && <span aria-label="host">👑</span>}
        </div>
        <ChamberPips pulled={hero?.pulled ?? 0} />
        <Button
          variant="outline"
          size="sm"
          onClick={() => setEmoteOpen(true)}
          aria-label={emoteMuted ? "Emotes (muted)" : "Open emote wheel"}
        >
          {emoteMuted ? "🔇" : "💬"} EMOTE
        </Button>
      </div>

      {/* fanned hand */}
      <HandFan disabled={!myTurn || pendingThrow} />

      {/* action row */}
      <div className="flex items-stretch justify-center gap-3 pb-2">
        <Button
          variant="brass"
          size="big"
          className="flex-1 text-xl"
          disabled={!myTurn || selectedCount === 0 || pendingThrow}
          onClick={() => void doThrow()}
          aria-live="polite"
        >
          {throwLabel()}
        </Button>
        <Button
          variant="danger"
          size="big"
          className="w-[38%]"
          disabled={!canCheck}
          onClick={onCheck}
          aria-describedby="check-hint"
        >
          {window_ && canCheck ? (
            <span>
              CHECK!
              <span className="ml-1 font-body text-xs">
                {accusedSeat !== null ? `vs seat ${accusedSeat + 1}` : ""}
              </span>
            </span>
          ) : (
            <span>
              CHECK
              <span id="check-hint" className="ml-1 font-body text-[11px] normal-case tracking-normal">
                armed when the window opens
              </span>
            </span>
          )}
        </Button>
      </div>

      <EmoteWheel open={emoteOpen} onClose={() => setEmoteOpen(false)} />
    </div>
  );
}
