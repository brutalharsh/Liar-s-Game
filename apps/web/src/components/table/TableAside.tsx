"use client";

import { Panel } from "@/components/ui/Panel";
import { useGameStore } from "@/store/game";
import { themeMeta } from "@/lib/mock/themes";
import { AnimatePresence, motion } from "motion/react";

/** Desktop side panel: room info + live event log (research/09 §2.2c). */
export function TableAside({ code }: { code: string }) {
  const lobby = useGameStore((s) => s.lobby);
  const feed = useGameStore((s) => s.feed);
  const roundNo = useGameStore((s) => s.roundNo);
  const seats = lobby?.seats ?? [];

  return (
    <>
      <Panel tone="deep" className="p-3">
        <p className="mb-1 font-body text-xs uppercase tracking-widest text-lamp">Room</p>
        <p className="font-display text-2xl tracking-[0.3em] text-brass">{code}</p>
        <p className="mt-1 font-body text-xs text-ink-dim">{lobby?.name}</p>
        <p className="mt-1 font-body text-xs text-ink-dim">
          Theme: {themeMeta(lobby?.theme ?? "saloon").name} · Round {roundNo || 1}
        </p>
      </Panel>

      <Panel tone="deep" className="p-3">
        <p className="mb-2 font-body text-xs uppercase tracking-widest text-lamp">Players</p>
        <ul className="flex flex-col gap-1.5">
          {seats
            .filter((s) => s.nickname)
            .map((s) => (
              <li key={s.seat} className="flex items-center justify-between gap-2 font-body text-xs">
                <span className={`flex items-center gap-1 ${s.alive ? "text-ivory" : "text-ink-dim line-through"}`}>
                  {s.isHost && <span aria-label="host">👑</span>}
                  {s.nickname}
                  {s.seat === 0 && <em className="not-italic text-red-text">(you)</em>}
                </span>
                <span className={s.alive ? "text-red-text" : "text-blood-bright"}>
                  {s.alive ? `${s.pulled}/6` : "out"}
                </span>
              </li>
            ))}
        </ul>
      </Panel>

      <Panel tone="deep" className="flex-1 p-3">
        <p className="mb-2 font-body text-xs uppercase tracking-widest text-lamp">Emote & event log</p>
        <ol aria-live="polite" className="flex flex-col gap-1">
          <AnimatePresence initial={false}>
            {feed.slice(-8).reverse().map((entry) => (
              <motion.li
                key={entry.id}
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                className="font-body text-[11px] text-ink-dim"
              >
                · {entry.text}
              </motion.li>
            ))}
          </AnimatePresence>
        </ol>
      </Panel>
    </>
  );
}
