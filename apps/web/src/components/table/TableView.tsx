"use client";

import { useMemo, useState } from "react";
import { GameTableShell } from "@/components/game/GameTableShell";
import { TableBanner, ContextRibbon } from "@/components/game/TableBanner";
import { PlayedPile } from "@/components/game/PlayedPile";
import { TableBottomPanel } from "@/components/table/TableBottomPanel";
import { TableAside } from "@/components/table/TableAside";
import { TableTopStrip } from "@/components/table/TableTopStrip";
import { CallGuardSheet } from "@/components/table/CallGuardSheet";
import { RevealStage } from "@/components/game/reveal/RevealStage";
import { ShotCinematic } from "@/components/game/shot/ShotCinematic";
import { RoundEndBanner } from "@/components/game/RoundEndBanner";
import { GameOverOverlay } from "@/components/game/GameOverOverlay";
import { GhostLounge, useGhostMode } from "@/components/game/GhostLounge";
import { useGameStore } from "@/store/game";

/**
 * /table/[code] — the live board. The store is the single source; every
 * layer below reads it via selectors (mock adapter today, S1 server
 * tomorrow — zero UI changes). The cinematic layer (reveal, shot,
 * round-end, game-over, ghost lounge) mounts alongside the shell.
 */
export function TableView({
  code,
  onLeave,
  roomId,
}: {
  code: string;
  onLeave: () => void;
  roomId: string;
}) {
  const [guardOpen, setGuardOpen] = useState(false);
  const lobby = useGameStore((s) => s.lobby);
  const window_ = useGameStore((s) => s.window);
  const lastPlay = useGameStore((s) => s.lastPlay);
  const heroSeat = useGameStore((s) => s.heroSeat);
  const forcedCall = useGameStore((s) => s.forcedCall);
  const ghost = useGhostMode();

  const seats = useMemo(() => lobby?.seats ?? [], [lobby]);

  // who the guard names is whoever the CHECK could target right now
  const accused = forcedCall
    ? (lastPlay?.seat ?? null)
    : window_ && window_.playSeat !== heroSeat
      ? window_.playSeat
      : (lastPlay?.seat ?? null);

  return (
    <div
      className={`relative h-[100dvh] w-full overflow-hidden ${ghost ? "ghost-spectate" : ""}`}
      data-room={roomId}
      data-ghost={ghost ? "1" : undefined}
    >
      <GameTableShell
        seats={seats}
        heroSeat={heroSeat}
        variant="table"
        topStrip={<TableTopStrip code={code} onLeave={onLeave} />}
        contextRibbon={<ContextRibbon />}
        pile={<PlayedPile />}
        banner={<TableBanner />}
        bottomBar={<TableBottomPanel onCheck={() => setGuardOpen(true)} />}
        aside={<TableAside code={code} />}
      />

      {/* cinematic layer — store-driven, self-animating */}
      <RevealStage />
      <ShotCinematic />
      <RoundEndBanner />
      <GameOverOverlay />
      <GhostLounge />

      <CallGuardSheet
        open={guardOpen}
        onClose={() => setGuardOpen(false)}
        accusedSeat={accused}
      />
    </div>
  );
}
