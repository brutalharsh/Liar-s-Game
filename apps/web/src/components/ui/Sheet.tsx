"use client";

import type { ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useViewportMode } from "@/hooks/useViewportMode";

/**
 * Modal dual-mode (STR/05 §1): bottom sheet on mobile, centered dialog on
 * desktop. role=dialog + Esc to close + basic focus handling.
 */
export function Sheet({
  open,
  onClose,
  title,
  children,
  dismissible = true,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  dismissible?: boolean;
}) {
  const mode = useViewportMode();

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[70] flex items-end justify-center lg:items-center">
          <motion.button
            aria-label="Close"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => dismissible && onClose()}
            className="absolute inset-0 bg-wood-deep/80 backdrop-blur-sm"
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={title}
            initial={mode === "mobile" ? { y: "100%" } : { scale: 0.92, opacity: 0 }}
            animate={mode === "mobile" ? { y: 0 } : { scale: 1, opacity: 1 }}
            exit={mode === "mobile" ? { y: "100%" } : { scale: 0.94, opacity: 0 }}
            transition={{ type: "spring", stiffness: 380, damping: 36 }}
            onKeyDown={(e) => {
              if (e.key === "Escape" && dismissible) onClose();
            }}
            className={`relative z-10 w-full border-2 border-brass-deep/60 bg-wood-deep shadow-panel lg:max-w-lg ${
              mode === "mobile" ? "rounded-t-card px-safe pb-safe pt-3" : "rounded-card"
            }`}
          >
            <div className="border-b-2 border-wood-mid/60 px-4 py-3">
              <div className="flex items-center justify-between gap-3">
                {mode === "mobile" && <span className="h-1.5 w-10 -translate-x-5 rounded-full bg-ink-dim/40" aria-hidden />}
                <h3 className="font-display text-xl text-ivory">{title}</h3>
                {dismissible && (
                  <button
                    onClick={onClose}
                    aria-label="Close dialog"
                    className="-mr-1 flex h-12 w-12 items-center justify-center rounded-full text-2xl text-ink-dim hover:text-ivory"
                  >
                    ×
                  </button>
                )}
              </div>
            </div>
            <div className="max-h-[70vh] overflow-y-auto p-4 lg:max-h-[65vh]">{children}</div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
