/**
 * Deadline helpers shared by both sides (STR/07 §4).
 *
 * All timing travels as server **deadline timestamps** in payloads; clients
 * compute the remaining time locally and render it. The SERVER is the only
 * party that ever acts on expiry (timeout actions go through the reducer).
 */

/** Milliseconds left until `deadlineTs`, clamped at 0. `nowMs` injectable for tests. */
export function remainingMs(deadlineTs: number, nowMs: number = Date.now()): number {
  return Math.max(0, deadlineTs - nowMs);
}

/** True once the deadline has passed (`nowMs >= deadlineTs`). */
export function isExpired(deadlineTs: number, nowMs: number = Date.now()): boolean {
  return nowMs >= deadlineTs;
}
