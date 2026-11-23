"use client";

import { create } from "zustand";

export type ToastTone = "info" | "good" | "bad";

export interface Toast {
  id: string;
  title: string;
  sub?: string;
  tone: ToastTone;
}

interface UiStore {
  /** Top-center toasts research/09 §6: max 2 stacked, 3s auto-dismiss. */
  toasts: Toast[];
  push: (toast: Omit<Toast, "id">) => void;
  dismiss: (id: string) => void;
}

const TOAST_MS = 3000;
const MAX_TOASTS = 2;

export const useUiStore = create<UiStore>()((set, get) => ({
  toasts: [],
  push: (toast) => {
    const id = `t-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
    const current = get().toasts;
    const next = [...current, { ...toast, id }].slice(-MAX_TOASTS);
    set({ toasts: next });
    setTimeout(() => get().dismiss(id), TOAST_MS);
  },
  dismiss: (id) => set({ toasts: get().toasts.filter((t) => t.id !== id) }),
}));

export const useToasts = () => useUiStore((s) => s.push);
