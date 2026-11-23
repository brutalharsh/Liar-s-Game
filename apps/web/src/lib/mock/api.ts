"use client";

/**
 * Mock fetch layer — every screen consumes mock data through this so all
 * screens share loading / empty / error states.
 *
 * Deterministic demo override (works on ANY mocked screen):
 *   ?mock=loading   → the query hangs (permanent loading state)
 *   ?mock=empty     → the query resolves with an empty value
 *   ?mock=error     → the query rejects
 *   (default)       → normal data after a small latency
 */

export type DemoMode = "ok" | "loading" | "empty" | "error";

const sleep = (ms: number) => new Promise<void>((res) => setTimeout(res, ms));

export function readDemoMode(): DemoMode {
  if (typeof window === "undefined") return "ok";
  const raw = new URLSearchParams(window.location.search).get("mock");
  if (raw === "loading" || raw === "empty" || raw === "error") return raw;
  return "ok";
}

interface MockFetchOptions {
  minDelayMs?: number;
  /** Value returned in ?mock=empty mode (defaults to [] for arrays, null otherwise). */
  emptyValue?: unknown;
}

export async function mockFetch<T>(data: T, opts: MockFetchOptions = {}): Promise<T> {
  const mode = readDemoMode();
  if (mode === "loading") {
    await sleep(60_000); // deliberately stuck skeleton for state verification
    return data;
  }
  if (mode === "empty") {
    return (Array.isArray(data) ? [] : opts.emptyValue ?? null) as T;
  }
  if (mode === "error") {
    await sleep(300);
    throw new Error("Mock request failed (demo mode)");
  }
  const delay = opts.minDelayMs ?? 420;
  await sleep(delay + Math.random() * 260);
  return data;
}
