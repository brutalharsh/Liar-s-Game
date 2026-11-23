"use client";

import { useMemo, useState } from "react";
import { GameTableShell } from "@/components/game/GameTableShell";
import { TableBanner, ContextRibbon } from "@/components/game/TableBanner";
import { PlayedPile } from "@/components/game/PlayedPile";
import { TableBottomPanel } from "@/components/table/TableBottomPanel";
import { TableAside } from "@/components/table/TableAside";
import { TableTopStrip } from "@/components/table/TableTopStrip";
import { CallGuardSheet } from "@/components/table/CallGuardSheet";
import type { SeatView } from "@/lib/wire";
import { useGameStore } from "@/store/game";

/**
 * /table/[code] — the route stub W2 wires to real socket events.
 * Renders BOTH layout shells from the same store snapshot: mock adapter
 * drives the demo round loop today, real server tomorrow, zero UI changes.
 */
export function TableView({
  code,
  seats,
  heroSeat,
  onLeave,
  roomId,
}: {
  code: string;
  seats: SeatView[];
  heroSeat: number;
  onLeave: () => void;
  roomId: string;
}) {
  const [guardOpen, setGuardOpen] = useState(false);
  const pile = useGameStore((s) => s.pile);
  const window_ = useGameStore((s) => s.window);
  const tableCard = useGameStore((s) => s.tableCard);
  const reveal = useGameStore((s) => s.reveal);

  const accused = useMemo(() => {
    const last = pile[pile.length - 1];
    return last?.seat ?? null;
  }, [pile]);

  return (
    <div className="h-[100dvh] w-full overflow-hidden" data-room={roomId}>
      <GameTableShell
        seats={seats}
        heroSeat={heroSeat}
        variant="table"
        topStrip={<TableTopStrip code={code} onLeave={onLeave} />}
        contextRibbon={<ContextRibbon />}
        pile={<PlayedPile />}
        banner={<TableBanner />}
        bottomBar={
          <TableBottomPanel
            canCheck={window_ !== null && accused !== null && accused !== heroSeat && reveal === null}
            accusedSeat={accused}
            tableCard={tableCard}
            onCheck={() => setGuardOpen(true)}
          />
        }
        aside={<TableAside code={code} />}
      />
      <CallGuardSheet
        open={guardOpen}
        onClose={() => setGuardOpen(false)}
        accusedSeat={accused}
        tableCard={tableCard}
        count={pile[pile.length - 1]?.count ?? 0}
      />
    </div>
  );
}
