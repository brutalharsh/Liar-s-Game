"use client";

import { create } from "zustand";
import { getMe, postLogout, type AuthMe } from "@/lib/api";

/**
 * Session state (STR/07 §0 / STR/08 §13). The session JWT lives in an httpOnly
 * cookie; this store only mirrors what GET /api/auth/me reports. Nothing is
 * ever persisted client-side — no tokens in localStorage, no persist().
 *
 * - fetchMe: probes the session once; 401 / absent session → guest.
 * - Transport failures keep status 'unknown' + expose `error` so the gate can
 *   offer a retry instead of flashing a wrong "signed out" state.
 */
export type AuthStatus = "unknown" | "authed" | "guest";

interface AuthStore {
  user: AuthMe | null;
  status: AuthStatus;
  error: string | null;
  fetchMe: (force?: boolean) => Promise<void>;
  logout: () => Promise<void>;
}

let inflight: Promise<void> | null = null;

export const useAuthStore = create<AuthStore>()((set, get) => ({
  user: null,
  status: "unknown",
  error: null,

  fetchMe: async (force = false) => {
    if (inflight) return inflight;
    if (get().status !== "unknown" && !force) return;
    inflight = (async () => {
      try {
        const user = await getMe();
        set({ user, status: user ? "authed" : "guest", error: null });
      } catch (err) {
        if (err instanceof Error && (err as { error?: string }).error === "AUTH_REQUIRED") {
          set({ user: null, status: "guest", error: null });
        } else {
          set({ user: null, status: "unknown", error: "Couldn't verify your session." });
        }
      } finally {
        inflight = null;
      }
    })();
    return inflight;
  },

  logout: async () => {
    try {
      await postLogout();
    } finally {
      set({ user: null, status: "guest", error: null });
    }
  },
}));
