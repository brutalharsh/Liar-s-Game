/**
 * RNG port (STR/08: ALL game RNG flows through an injected crypto port —
 * never Math.random in game paths). Two implementations:
 *
 *  - `NodeCryptoRng` — production PRNG backed by node:crypto.randomInt.
 *  - `SeededRng`      — splitmix64-seeded xoshiro256** stream: deterministic,
 *                       replayable, and unpredictable enough that leaked
 *                       public outputs (~1.6 bits/round) can't recover state.
 *
 * PRODUCTION PATTERN for S1 (replay guarantee): mint
 * `const seed = randomInt(0, Number.MAX_SAFE_INTEGER)` once per match,
 * construct `new SeededRng(seed)`, and persist the seed with the match log —
 * `replay({ seed, events })` then reproduces the match bit-for-bit.
 * `NodeCryptoRng` remains available for non-replay/parity use.
 */
import { randomInt } from 'node:crypto';
import type { RngPortLike } from './types';

// TODO-sync-with-shared (canonical interface)
export interface RngPort extends RngPortLike {}

/** Uniform integer, both ends inclusive. */
export type IntFn = (minInclusive: number, maxInclusive: number) => number;

/** Shared Fisher–Yates (doc-14 task 13). `intFn` must be uniform on [0, i]. */
export function fisherYatesShuffle<T>(items: readonly T[], intFn: IntFn): T[] {
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = intFn(0, i);
    const tmp = out[i];
    out[i] = out[j];
    out[j] = tmp;
  }
  return out;
}

/** node:crypto implementation (injectable, zero state). */
export class NodeCryptoRng implements RngPort {
  int(minInclusive: number, maxInclusive: number): number {
    return randomInt(minInclusive, maxInclusive + 1);
  }
  pick<T>(items: readonly T[]): T {
    return items[this.int(0, items.length - 1)];
  }
  shuffle<T>(items: readonly T[]): T[] {
    return fisherYatesShuffle(items, (a, b) => this.int(a, b));
  }
}

const MASK64 = (1n << 64n) - 1n;

function rotl64(x: bigint, k: bigint): bigint {
  return ((x << k) | (x >> (64n - k))) & MASK64;
}

function splitmix64(state: bigint): { state: bigint; value: bigint } {
  let z = (state + 0x9e3779b97f4a7c15n) & MASK64;
  z = ((z ^ (z >> 30n)) * 0xbf58476d1ce4e5b9n) & MASK64;
  z = ((z ^ (z >> 27n)) * 0x94d049bb133111ebn) & MASK64;
  return { state: z, value: z ^ (z >> 31n) };
}

/** Deterministic xoshiro256** stream seeded via splitmix64. */
export class SeededRng implements RngPort {
  private s0: bigint;
  private s1: bigint;
  private s2: bigint;
  private s3: bigint;

  constructor(seed: number) {
    let sm = BigInt(Math.trunc(seed)) & MASK64;
    const draws: bigint[] = [];
    for (let i = 0; i < 4; i++) {
      const r = splitmix64(sm);
      sm = r.state;
      draws.push(r.value);
    }
    this.s0 = draws[0];
    this.s1 = draws[1];
    this.s2 = draws[2];
    this.s3 = draws[3];
  }

  private next64(): bigint {
    const result = (rotl64((this.s1 * 5n) & MASK64, 7n) * 9n) & MASK64;
    const t = this.s1 << 17n;
    this.s2 ^= this.s0;
    this.s3 ^= this.s1;
    this.s1 ^= this.s2;
    this.s0 ^= t;
    this.s2 = rotl64(this.s2, 45n);
    this.s3 = rotl64(this.s3, 11n);
    return result;
  }

  /** Uniform on [min, max], exact rejection sampling (no modulo bias). */
  int(minInclusive: number, maxInclusive: number): number {
    if (maxInclusive < minInclusive) throw new Error(`RngPort.int: empty range [${minInclusive},${maxInclusive}]`);
    const range = BigInt(maxInclusive - minInclusive + 1);
    const limit = (MASK64 + 1n) / range * range; // first multiple of range ≤ 2^64
    let x = this.next64();
    while (x >= limit) x = this.next64();
    return minInclusive + Number(x % range);
  }

  pick<T>(items: readonly T[]): T {
    if (items.length === 0) throw new Error('RngPort.pick: empty items');
    return items[this.int(0, items.length - 1)];
  }

  shuffle<T>(items: readonly T[]): T[] {
    return fisherYatesShuffle(items, (a, b) => this.int(a, b));
  }
}
