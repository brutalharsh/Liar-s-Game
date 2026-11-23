"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { MockQuery } from "@/hooks/useMockQuery";
import { getRooms, type RoomsPage } from "@/lib/api";

/**
 * GET /api/rooms loader + ~10s poll while the tab is visible (STR/02 v1 room
 * browser). Presents the same { data, loading, error, reload } shape
 * useMockQuery does so <AsyncSection> keeps its loading/empty/error
 * treatment. Poll refreshes are silent; a failed poll never throws away the
 * last good list — the error state only surfaces when there is no data yet.
 */

const POLL_INTERVAL_MS = 10_000;

export function useRoomsPoll(params: { page?: number; perPage?: number } = {}): MockQuery<RoomsPage> {
  const [data, setData] = useState<RoomsPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [nonce, setNonce] = useState(0);
  const aliveRef = useRef(true);
  const hasDataRef = useRef(false);
  const inFlightRef = useRef(false);

  useEffect(() => {
    aliveRef.current = true;

    const fetchOnce = async (): Promise<void> => {
      if (inFlightRef.current) return; // one poll at a time
      inFlightRef.current = true;
      try {
        const page = await getRooms(params);
        hasDataRef.current = true;
        // Commit is gated by the instance ref, not an effect-closure flag:
        // React StrictMode double-mounts the effect (dev), the first run's
        // await resolves *after* its own cleanup flipped `cancelled` — a
        // closure check there would discard the page and freeze the list on
        // the skeleton until the first poll tick. aliveRef is reset to true
        // by the remount and only goes false on a real unmount.
        if (aliveRef.current) {
          setData(page);
          setError(null);
          setLoading(false);
        }
      } catch (err) {
        if (aliveRef.current) {
          if (!hasDataRef.current) {
            // total failure — no list on the wall, surface the error treatment
            setError(err instanceof Error ? err : new Error("Something went wrong"));
            setLoading(false);
          }
          // else: a failed refresh keeps the last good list on the wall
        }
      } finally {
        inFlightRef.current = false;
      }
    };

    void fetchOnce();

    const tick = (): void => {
      if (typeof document === "undefined" || document.visibilityState === "visible") {
        void fetchOnce();
      }
    };
    const timer = setInterval(tick, POLL_INTERVAL_MS);
    const onVisible = (): void => {
      if (document.visibilityState === "visible") tick();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      aliveRef.current = false;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.page, params.perPage, nonce]);

  const reload = useCallback((): void => {
    setLoading(true);
    setError(null);
    setNonce((n) => n + 1);
  }, []);

  return { data, loading, error, reload };
}
