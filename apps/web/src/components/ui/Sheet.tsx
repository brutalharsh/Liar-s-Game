"use client";

import { useEffect, useRef } from "react";
import type { ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useViewportMode } from "@/hooks/useViewportMode";

/**
 * Modal dual-mode (STR/05 §1): bottom sheet on mobile, centered dialog on
 * desktop. role=dialog, focus lands on the dialog itself on open, Tab cycles
 * within it, Esc (document-level) closes, and the opener gets focus back on
 * close — the WAI-ARIA dialog pattern (STR/05 §7 focus order on dialogs).
 */

/** Focusables the Tab trap cycles through (scoped to inside the dialog). */
const FOCUSABLE_SELECTOR = [
  "a[href]:not([disabled])",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

/** Open sheets, top-most last — Esc closes only the top of the stack. */
const openSheets: symbol[] = [];

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
  const dialogRef = useRef<HTMLDivElement | null>(null);
  // callers pass inline lambdas — refs keep the choreography from re-running
  // (and re-capturing focus) on every render
  const onCloseRef = useRef(onClose);
  const dismissibleRef = useRef(dismissible);
  useEffect(() => {
    onCloseRef.current = onClose;
    dismissibleRef.current = dismissible;
  });

  useEffect(() => {
    if (!open) return undefined;
    const id = Symbol("sheet");
    openSheets.push(id);
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    dialogRef.current?.focus();
    const onKeyDown = (e: KeyboardEvent) => {
      const dialog = dialogRef.current;
      if (!dialog) return;
      if (e.key === "Escape") {
        if (dismissibleRef.current && openSheets[openSheets.length - 1] === id) onCloseRef.current();
        return;
      }
      if (e.key !== "Tab") return;
      const focusables = Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
        (el) => el.getClientRects().length > 0,
      );
      if (focusables.length === 0) {
        e.preventDefault(); // nothing inner to walk — the dialog stays the focus home
        dialog.focus();
        return;
      }
      const first = focusables[0] as HTMLElement;
      const last = focusables[focusables.length - 1] as HTMLElement;
      const active = document.activeElement;
      if (active === dialog) {
        if (e.shiftKey) {
          e.preventDefault();
          last.focus(); // entering the cycle from behind → start at the end
        }
        return; // plain Tab falls through to the first focusable naturally
      }
      if (!dialog.contains(active)) {
        e.preventDefault(); // focus escaped to the background — pull it back in
        (e.shiftKey ? last : first).focus();
        return;
      }
      if (e.shiftKey && active === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      openSheets.splice(openSheets.indexOf(id), 1);
      opener?.focus(); // restore — close never strands focus on <body>
    };
  }, [open]);

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
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-label={title}
            tabIndex={-1}
            initial={
              mode === "desktop"
                ? { y: 0, scale: 0.92, opacity: 0 }
                : { y: "100%", scale: 1, opacity: 1 }
            }
            animate={{ y: 0, scale: 1, opacity: 1 }}
            exit={
              mode === "desktop"
                ? { y: 0, scale: 0.94, opacity: 0 }
                : { y: "100%", scale: 1, opacity: 1 }
            }
            transition={{ type: "spring", stiffness: 380, damping: 36 }}
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
