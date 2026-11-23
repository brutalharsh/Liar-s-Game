"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export interface MockQuery<T> {
  data: T | null;
  loading: boolean;
  error: Error | null;
  reload: () => void;
}

/**
 * Loads mock data on mount with visible loading → ready/error transitions.
 * Pair with <AsyncSection> for the standard loading/empty/error treatment.
 */
export function useMockQuery<T>(loader: () => Promise<T>, deps: readonly unknown[] = []): MockQuery<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [nonce, setNonce] = useState(0);
  const aliveRef = useRef(true);

  useEffect(() => {
    aliveRef.current = true;
    setLoading(true);
    setError(null);
    loader()
      .then((res) => {
        if (aliveRef.current) {
          setData(res);
          setLoading(false);
        }
      })
      .catch((err: unknown) => {
        if (aliveRef.current) {
          setError(err instanceof Error ? err : new Error("Something went wrong"));
          setLoading(false);
        }
      });
    return () => {
      aliveRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, nonce]);

  const reload = useCallback(() => setNonce((n) => n + 1), []);
  return { data, loading, error, reload };
}
