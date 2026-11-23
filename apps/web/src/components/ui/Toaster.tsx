"use client";

import { AnimatePresence, motion } from "motion/react";
import { useUiStore } from "@/store/ui";

/** Top-center toasts — max 2 stacked, 3s auto-dismiss (research/09 §6). */
export function Toaster() {
  const toasts = useUiStore((s) => s.toasts);
  const dismiss = useUiStore((s) => s.dismiss);

  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 top-0 z-[80] flex flex-col items-center gap-2 px-4 pt-safe"
    >
      <AnimatePresence initial={false}>
        {toasts.map((toast) => (
          <motion.button
            key={toast.id}
            type="button"
            layout
            initial={{ opacity: 0, y: -24, scale: 0.92 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -12, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
            onClick={() => dismiss(toast.id)}
            className={`pointer-events-auto max-w-sm rounded-btn border-2 px-4 py-2 text-left shadow-panel backdrop-blur ${
              toast.tone === "good"
                ? "border-verdict bg-wood-deep/95"
                : toast.tone === "bad"
                  ? "border-blood bg-wood-deep/95"
                  : "border-brass-deep bg-wood-deep/95"
            }`}
          >
            <span className="block font-display text-sm text-ivory">{toast.title}</span>
            {toast.sub && <span className="block font-body text-xs text-ink-dim">{toast.sub}</span>}
          </motion.button>
        ))}
      </AnimatePresence>
    </div>
  );
}
