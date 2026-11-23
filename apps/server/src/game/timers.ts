/**
 * Authoritative timer wheel (S1).
 *
 * The ENGINE's clock fields are the ONLY authority — the wheel computes
 * delays from `turn.deadline`, `window.closesAt`, `disconnectedAt + graceMs`
 * and re-validates through `apply()` on every fire (the engine rejects stale
 * or too-early fires with typed errors, which callers swallow and re-arm).
 * Shared `remainingMs` does the deadline math (STR/07 §4 — server deadlines,
 * clients only render).
 *
 * Exactly-once guarantees:
 *  - token-based slots: each `schedule(key, …)` replaces the prior entry with
 *    the same key and kills its token; a late fire (or a forced double-fire
 *    in tests) hits a dead token and no-ops;
 *  - drift-safe: fire callbacks always re-check via the engine reducer, so a
 *    timer landing after a user action is rejected by the engine and re-armed
 *    from the fresh state fields;
 *  - `cancel(key)` is idempotent;
 *  - `cancelExcept(prefixes)` lets a room recycle its slots between matches
 *    without touching seat-grace or GC timers.
 *
 * All handles are `unref`-ed: the HTTP/io servers keep the process alive; the
 * wheel never holds vitest forks open.
 */
import { remainingMs } from '@liars-game/shared';
import type { GameTiming } from './types.js';

interface Slot {
  token: number;
  timeout: NodeJS.Timeout;
  at: number;
  fire: () => void;
}

export class TimerWheel {
  private nextToken = 1;
  private readonly slots = new Map<string, Slot>();

  constructor(
    private readonly timers: GameTiming,
    private readonly now: () => number,
  ) {
    void this.timers; // reserved for pacing math callers reuse
  }

  /** True once `deadline` has passed on the authoritative clock. */
  isExpired(deadline: number): boolean {
    return this.now() >= deadline;
  }

  /** Ms left to a deadline (0 when past) — shared deadline math. */
  remaining(deadline: number): number {
    return remainingMs(deadline, this.now());
  }

  /**
   * Schedules `fire` at absolute epoch-ms `at` under `key` (replacing any
   * prior entry with that key). Past-due deadlines clamp to an immediate
   * `setTimeout(0)` so ordering stays inside the event loop.
   */
  schedule(key: string, at: number, fire: () => void): void {
    this.cancel(key);

    const token = this.nextToken;
    this.nextToken += 1;
    const delay = Math.max(0, at - this.now());
    const timeout = setTimeout(() => {
      const slot = this.slots.get(key);
      if (!slot || slot.token !== token) return; // late fire / replaced / cancelled
      this.slots.delete(key);
      fire();
    }, delay);
    timeout.unref?.();
    this.slots.set(key, { token, timeout, at, fire });
  }

  /** Idempotent cancel. */
  cancel(key: string): void {
    const slot = this.slots.get(key);
    if (!slot) return;
    clearTimeout(slot.timeout);
    this.slots.delete(key);
  }

  /**
   * Recycles every slot whose key does NOT start with one of the kept
   * prefixes (seat grace `grace:` and the room `gc` sweep survive match
   * transitions).
   */
  cancelExcept(keepPrefixes: readonly string[]): void {
    for (const key of [...this.slots.keys()]) {
      if (keepPrefixes.some((p) => key.startsWith(p))) continue;
      this.cancel(key);
    }
  }

  /** Nukes everything (room close/teardown). */
  cancelAll(): void {
    for (const key of [...this.slots.keys()]) {
      this.cancel(key);
    }
  }

  /** Scheduled deadline for a key (grace arithmetic + test assertions). */
  deadlineOf(key: string): number | undefined {
    return this.slots.get(key)?.at;
  }

  /** True while `key` is armed — rollover/cancel assertions. */
  has(key: string): boolean {
    return this.slots.has(key);
  }

  get pendingCount(): number {
    return this.slots.size;
  }

  /**
   * Test-only backdoor: run a key's callback NOW (once — the token dies with
   * the first fire). Double-force must no-op: that is the exactly-once
   * tripwire. The callback still re-validates against the engine.
   */
  force(key: string): void {
    const slot = this.slots.get(key);
    if (!slot) return;
    this.slots.delete(key);
    clearTimeout(slot.timeout);
    slot.fire();
  }
}
