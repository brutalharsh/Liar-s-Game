"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "motion/react";
import { Avatar } from "@/components/ui/Avatar";
import { ChamberPips } from "@/components/game/ChamberPips";
import { HandFan } from "@/components/game/HandFan";
import { Button } from "@/components/ui/Button";
import { useGameStore } from "@/store/game";
import { useSettingsStore } from "@/store/settings";
import { rankWord } from "@/lib/format";
import { vibrate } from "@/lib/haptics";
import { playSfx } from "@/lib/sfx";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";
import { useGhostMode } from "@/components/game/GhostLounge";
import { EmoteWheel } from "@/components/game/EmoteWheel";
import { TimerArc } from "@/components/game/TimerArc";
import { CrownIcon, EmoteIcon, MuteIcon } from "@/components/ui/icons";

/**
 * Hero strip + fanned hand + the two critical buttons (research/09 §§2–3,
 * STR/05 §3):
 *   THROW (≥64px) — live claim text "THROW 2 AS KINGS"; disabled off-turn.
 *   CHECK (≥64px, bottom-right thumb zone) — HIDDEN while illegal; arming
 *   chip for the 2s arm-delay after a play lands; then armed with the 10s
 *   countdown ring for open windows (5–10p) or the plain judge-turn LIAR
 *   call (2–4p). Any tap opens the CONFIRM GUARD sheet first.
 * Keyboard parity (desktop — Liar's Bar muscle memory, research/09 §7):
 *   1/2/3 select · A/D move · Space toggle · E throw · X check.
 */
const WINDOW_ARM_MS = 2_000;

export function TableBottomPanel({ onCheck }: { onCheck: () => void }) {
  const [emoteOpen, setEmoteOpen] = useState(false);
  const heroSeat = useGameStore((s) => s.heroSeat);
  const hero = useGameStore((s) => s.seatByNumber(s.heroSeat));
  const selectedCount = useGameStore((s) => s.selectedCardIds.length);
  const pendingThrow = useGameStore((s) => s.pendingThrow);
  const turnSeat = useGameStore((s) => s.turnSeat);
  const phase = useGameStore((s) => s.phase);
  const window_ = useGameStore((s) => s.window);
  const accusedName = useGameStore((s) => (s.window && s.window.playSeat !== s.heroSeat ? s.nicknameOf(s.window.playSeat) : ""));
  const lastPlay = useGameStore((s) => s.lastPlay);
  const tableCard = useGameStore((s) => s.tableCard);
  const sendThrow = useGameStore((s) => s.sendThrow);
  const emoteMuted = useSettingsStore((s) => s.emoteMuted);
  const reduced = usePrefersReducedMotion();
  const ghost = useGhostMode();

  // local 500ms beat ONLY while a window is open — drives arm→armed + seconds
  const [, tickWindow] = useState(0);
  useEffect(() => {
    if (!window_) return undefined;
    const t = setInterval(() => tickWindow((n) => n + 1), 500);
    return () => clearInterval(t);
  }, [window_]);

  const myTurn = turnSeat === heroSeat && !ghost;
  const now = Date.now();
  const windowForMe = window_ !== null && window_.playSeat !== heroSeat;
  const arming = windowForMe && now - window_.openedAt < WINDOW_ARM_MS;
  const armed = windowForMe && !arming;
  const judgeTurnCall = myTurn && window_ === null && lastPlay !== null && lastPlay.seat !== heroSeat;
  const showCheck = (armed || arming || judgeTurnCall) && !ghost;

  const secondsLeft = windowForMe ? Math.max(0, Math.ceil((window_.closesAtTs - now) / 1000)) : 0;
  const throwLabel = useMemo(() => {
    if (pendingThrow) return "WAIT…";
    if (!myTurn) return "WAIT — NOT YOUR TURN";
    if (selectedCount === 0) return "SELECT 1–3 CARDS";
    const rank = tableCard ? rankWord(tableCard) : "…";
    return `THROW ${selectedCount} AS ${rank}${selectedCount === 1 ? "" : "S"}`;
  }, [pendingThrow, myTurn, selectedCount, tableCard]);

  const doThrow = async () => {
    const s = useGameStore.getState();
    if (s.turnSeat !== s.heroSeat || s.pendingThrow || s.selectedCardIds.length === 0) return;
    vibrate("throw", reduced);
    playSfx("throw");
    const res = await s.sendThrow();
    if (!res.ok) playSfx("toast");
  };

  // keyboard parity — research/09 §7
  useEffect(() => {
    const wide = window.matchMedia("(min-width: 1024px)").matches;
    if (!wide) return undefined;
    const onKey = (e: KeyboardEvent) => {
      const s = useGameStore.getState();
      const w = s.window;
      const ghostNow = s.spectator || s.seatByNumber(s.heroSeat)?.alive === false; // ghosts are emote-only — no THROW/CHECK keys (U8)
      const armedNow = w !== null && w.playSeat !== s.heroSeat && Date.now() - w.openedAt >= WINDOW_ARM_MS && !ghostNow;
      const judgeNow = s.turnSeat === s.heroSeat && w === null && s.lastPlay !== null && s.lastPlay.seat !== s.heroSeat && !ghostNow;
      if (e.key >= "1" && e.key <= "3") {
        const card = s.hand[Number(e.key) - 1];
        if (card) s.toggleCardSelection(card.id);
      } else if (e.key.toLowerCase() === "e" && !ghostNow) {
        void doThrow();
      } else if (e.key.toLowerCase() === "x") {
        if (armedNow || judgeNow) {
          vibrate("challenge-confirm", reduced);
          onCheck();
        }
      } else if (e.key.toLowerCase() === "a" || e.key.toLowerCase() === "d") {
        // walk-selection (research/09 §7): A/D step the selection through the fan
        // with wraparound; the move anchors at the trailing/leading selected card
        // so it never dead-ends at card 1 after the first pick
        const dir = e.key.toLowerCase() === "a" ? -1 : 1;
        const idxs = s.selectedCardIds
          .map((id) => s.hand.findIndex((c) => c.id === id))
          .filter((i) => i >= 0);
        let idx: number;
        if (idxs.length === 0) {
          idx = dir === 1 ? 0 : s.hand.length - 1;
        } else {
          const anchor = dir === 1 ? Math.max(...idxs) : Math.min(...idxs);
          idx = (anchor + dir + s.hand.length) % s.hand.length;
        }
        const card = s.hand[idx];
        if (card && !s.selectedCardIds.includes(card.id)) s.toggleCardSelection(card.id);
      } else if (e.key === " ") {
        const card = s.hand.find((c) => !s.selectedCardIds.includes(c.id)) ?? s.hand[0];
        if (card) s.toggleCardSelection(card.id);
        e.preventDefault();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduced]);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-2 border-t-2 border-wood-mid/60 bg-wood/70 px-3 pt-2">
      {/* hero strip */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Avatar spec={hero?.avatar ?? null} size="md" dimmed={ghost} />
          <span className="font-display text-lg text-ivory">
            {hero?.nickname ?? "YOU"}
            {ghost && <em className="ml-1 not-italic font-body text-[10px] text-ink-dim">(ghost)</em>}
          </span>
          {hero?.isHost && <CrownIcon size={16} label="host" className="text-brass" />}
        </div>
        <ChamberPips pulled={hero?.pulled ?? 0} />
        <Button
          variant="outline"
          size="sm"
          onClick={() => setEmoteOpen(true)}
          aria-label={emoteMuted ? "Emotes (muted)" : "Open emote wheel"}
        >
          {emoteMuted ? <MuteIcon size={16} /> : <EmoteIcon size={16} />} EMOTE
        </Button>
      </div>

      {/* fanned hand — dead input when it's not your call or you're spectating */}
      <HandFan disabled={!myTurn || pendingThrow} />

      {/* action row — ghosts are emote-only: no gray THROW stub rides the
          felt for the dead (U8 spec) */}
      {!ghost && (
        <div className="flex items-stretch justify-center gap-3 pb-2">
        <Button
          variant="brass"
          size="big"
          className="min-h-16 flex-1 text-xl"
          disabled={!myTurn || !(!pendingThrow && selectedCount > 0)}
          onClick={() => void doThrow()}
          aria-live="polite"
          aria-keyshortcuts="E"
        >
          {throwLabel}
        </Button>

        {/* CHECK — hidden while illegal, armed with the 10s ring (STR/03 §2) */}
        {showCheck && (
          <motion.div
            key="check"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: reduced ? 0 : 0.2 }}
            className="relative"
          >
            <Button
              variant="danger"
              size="big"
              className="min-h-16 w-40"
              disabled={!armed && !judgeTurnCall}
              onClick={() => {
                vibrate("challenge-confirm", reduced);
                playSfx("challenge-slam");
                onCheck();
              }}
              aria-label="Call the previous throw a lie — opens a confirm guard"
              aria-keyshortcuts="X"
            >
              {arming ? (
                <span className="flex flex-col items-center leading-tight">
                  <span>CHECK…</span>
                  <span className="font-body text-[10px] normal-case tracking-normal">window arming · 2s</span>
                </span>
              ) : armed && window_ ? (
                <span className="flex flex-col items-center leading-tight">
                  <span>CHECK · {secondsLeft}s</span>
                  <span className="font-body text-[10px] normal-case tracking-normal">vs {accusedName}</span>
                </span>
              ) : (
                <span className="flex flex-col items-center leading-tight">
                  <span>CALL LIAR</span>
                  <span className="font-body text-[10px] normal-case tracking-normal">judge the last throw</span>
                </span>
              )}
            </Button>
            {/* the 10s countdown ring rides the button's shoulder */}
            {armed && window_ && (
              <span className="pointer-events-none absolute -right-2 -top-2">
                <TimerArc deadlineTs={window_.closesAtTs} size={34} width={3} className="drop-shadow" label="challenge window" />
              </span>
            )}
            {/* arm-delay representation — thin rail filling over 2s after the play */}
            {arming && window_ && (
              <span className="pointer-events-none absolute -bottom-1 left-2 right-2 h-1 overflow-hidden rounded-full bg-wood-deep">
                <span
                  className="block h-full rounded-full bg-lamp"
                  style={{
                    width: `${Math.min(100, ((now - window_.openedAt) / WINDOW_ARM_MS) * 100)}%`,
                    transition: "width 0.4s linear",
                  }}
                />
              </span>
            )}
          </motion.div>
        )}
        </div>
      )}

      <EmoteWheel open={emoteOpen} onClose={() => setEmoteOpen(false)} />
    </div>
  );
}
