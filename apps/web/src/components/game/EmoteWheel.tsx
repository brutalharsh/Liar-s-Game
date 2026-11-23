"use client";

import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { EMOTE_PRESETS, EMOTE_COOLDOWN_MS } from "@/lib/mock/emotes";
import { socket } from "@/lib/socket";
import { useGameStore } from "@/store/game";
import { useSettingsStore } from "@/store/settings";
import { useToasts } from "@/store/ui";
import { useGameTable } from "@/components/game/gameTableContext";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";

/**
 * Emote wheel — grid on mobile, radial petals on desktop (research/09 §5).
 * 10 presets (STR/05 §6), 3s per-player cooldown. Mute-all honored.
 * This IS the table talk: no free text, ever.
 */
export function EmoteWheel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { mode } = useGameTable();
  const muted = useSettingsStore((s) => s.emoteMuted);
  const lastSentAt = useGameStore((s) => s.lastEmoteSentAt);
  const noteSent = useGameStore((s) => s.noteEmoteSent);
  const push = useToasts();
  const reduced = usePrefersReducedMotion();
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (!open) return;
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, [open]);

  if (!open) return null;

  const remaining = Math.max(0, lastSentAt + EMOTE_COOLDOWN_MS - now);
  const cooling = remaining > 0;

  const send = async (emoteId: string) => {
    if (muted) {
      push({ title: "Emotes are muted", tone: "info" });
      return;
    }
    if (cooling) return; // no toast spam during cooldown
    const preset = EMOTE_PRESETS.find((p) => p.id === emoteId);
    const res = await socket.emit({ type: "emote:send", emoteId });
    if (!res.ok) {
      push({ title: res.errorMessage ?? "Emote rejected", tone: "bad" });
      return;
    }
    noteSent();
    push({ title: `${preset?.emoji ?? ""} ${preset?.label ?? "emote"}`, tone: "info" });
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center pb-safe lg:items-center">
      <motion.button
        aria-label="Close emotes"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="absolute inset-0 bg-wood-deep/70 backdrop-blur-sm"
        onClick={onClose}
      />
      {muted ? (
        <motion.div
          initial={{ y: 40, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="relative z-10 mb-4 rounded-card border-2 border-wood-mid bg-wood px-6 py-4 text-center font-body text-sm text-ink-dim"
        >
          Emotes are muted — re-enable them in Settings.
        </motion.div>
      ) : mode === "mobile" ? (
        <motion.nav
          aria-label="Emotes"
          initial={{ y: "100%" }}
          animate={{ y: 0 }}
          transition={reduced ? { duration: 0 } : { type: "spring", stiffness: 360, damping: 34 }}
          className="relative z-10 grid w-full grid-cols-5 gap-1 rounded-t-card border-t-2 border-brass-deep bg-wood-deep p-2 px-safe pb-safe"
        >
          {EMOTE_PRESETS.map((preset) => (
            <button
              key={preset.id}
              onClick={() => void send(preset.id)}
              disabled={cooling}
              className="flex min-h-12 flex-col items-center justify-center rounded-btn px-1 py-2 hover:bg-wood active:scale-95 disabled:opacity-40"
              aria-label={preset.label}
            >
              <span aria-hidden className="text-xl">
                {preset.emoji}
              </span>
              <span className="max-w-16 truncate font-body text-[8px] leading-tight text-ink-dim">{preset.label}</span>
            </button>
          ))}
        </motion.nav>
      ) : (
        <motion.nav
          aria-label="Emotes"
          initial={{ scale: 0.6, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={reduced ? { duration: 0 } : { type: "spring", stiffness: 320, damping: 26 }}
          className="relative z-10 h-64 w-64 rounded-full border-2 border-wood-mid/50 bg-wood-deep"
        >
          <button
            onClick={onClose}
            aria-label="Close emotes"
            className="absolute left-1/2 top-1/2 flex h-12 w-12 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-brass-deep bg-wood font-display text-brass"
          >
            ×
          </button>
          {EMOTE_PRESETS.map((preset, i) => {
            const angle = (2 * Math.PI * i) / EMOTE_PRESETS.length - Math.PI / 2;
            const x = 50 + 38 * Math.cos(angle);
            const y = 50 + 38 * Math.sin(angle);
            return (
              <button
                key={preset.id}
                onClick={() => void send(preset.id)}
                disabled={cooling}
                style={{ left: `${x}%`, top: `${y}%` }}
                className="absolute flex h-14 w-14 -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center rounded-full border-2 border-brass-deep bg-wood hover:bg-brass/15 disabled:opacity-40"
                aria-label={preset.label}
                title={preset.label}
              >
                <span aria-hidden className="text-xl">
                  {preset.emoji}
                </span>
              </button>
            );
          })}
        </motion.nav>
      )}
      {cooling && (
        <div className="fixed bottom-2 left-1/2 z-[75] -translate-x-1/2 rounded-full bg-wood-deep px-3 py-1 font-body text-xs text-brass">
          emote cooldown {Math.ceil(remaining / 1000)}s
        </div>
      )}
    </div>
  );
}
