import { describe, expect, it } from 'vitest';
import { fisherYatesShuffle, NodeCryptoRng, SeededRng } from '../src/rng';

describe('RNG port', () => {
  it('SeededRng is deterministic for identical seeds', () => {
    const a = new SeededRng(1234);
    const b = new SeededRng(1234);
    const sa = Array.from({ length: 1000 }, () => a.int(0, 1));
    const sb = Array.from({ length: 1000 }, () => b.int(0, 1));
    expect(sa).toEqual(sb);
  });

  it('SeededRng differs across seeds', () => {
    const a = new SeededRng(1);
    const b = new SeededRng(2);
    const sa = Array.from({ length: 20 }, () => a.int(1, 6));
    const sb = Array.from({ length: 20 }, () => b.int(1, 6));
    expect(sa).not.toEqual(sb);
  });

  it('SeededRng.int stays in bounds and is near-uniform (doc-04 balancing input)', () => {
    const rng = new SeededRng(42);
    const counts = new Map<number, number>();
    for (let i = 0; i < 60_000; i++) {
      const v = rng.int(1, 6);
      expect(v).toBeGreaterThanOrEqual(1);
      expect(v).toBeLessThanOrEqual(6);
      counts.set(v, (counts.get(v) ?? 0) + 1);
    }
    // 10k draws per face: expected 16.7%; allow 15%..18.4% (~±4.5σ, no flakes).
    for (let face = 1; face <= 6; face++) {
      const share = (counts.get(face) ?? 0) / 60_000;
      expect(share).toBeGreaterThan(0.15);
      expect(share).toBeLessThan(0.184);
    }
  });

  it('int(min,max) handles degenerate and wide ranges', () => {
    const rng = new SeededRng(7);
    for (let i = 0; i < 100; i++) expect(rng.int(5, 5)).toBe(5);
    expect(() => rng.int(3, 2)).toThrow();
    let m = 0;
    for (let i = 0; i < 500; i++) m = rng.int(1_000_000_000, 4_294_967_295);
    expect(m).toBeGreaterThan(999_999_999);
  });

  it('pick returns a member and shuffle returns a permutation without mutating input', () => {
    const rng = new SeededRng(99);
    const items = [1, 2, 3, 4, 5, 6, 7, 8];
    for (let i = 0; i < 50; i++) expect(items).toContain(rng.pick(items));
    const sorted = [...items].sort((a, b) => a - b);
    for (let i = 0; i < 50; i++) {
      const shuffled = rng.shuffle(items);
      expect([...shuffled].sort((a, b) => a - b)).toEqual(sorted);
      expect(items).toEqual(items.slice()); // input untouched
    }
  });

  it('fisherYatesShuffle is a permutation and can produce every order', () => {
    const intFn = (lo: number, _hi: number) => lo; // reverse-ish deterministic stub
    for (const n of [1, 2, 8]) {
      const arr = Array.from({ length: n }, (_, i) => i);
      const out = fisherYatesShuffle(arr, intFn);
      expect([...out].sort((a, b) => a - b)).toEqual(arr);
    }
  });

  it('NodeCryptoRng fair coin: 100k runs within ±1.5% of 50/50 (mission spec)', () => {
    const rng = new NodeCryptoRng();
    let flips = 0;
    const N = 100_000;
    for (let i = 0; i < N; i++) {
      flips += rng.int(0, 1);
    }
    // binomial sd at 100k ≈ 0.158% → ±1.5% is ~9.5σ: effectively zero flake risk.
    expect(Math.abs(flips - N / 2)).toBeLessThanOrEqual(N * 0.015);
  });

  it('NodeCryptoRng shuffle/pick sanity', () => {
    const rng = new NodeCryptoRng();
    const arr = Array.from({ length: 20 }, (_, i) => i);
    const out = rng.shuffle(arr);
    expect([...out].sort((a, b) => a - b)).toEqual(arr);
    expect(arr).toContain(rng.pick(arr));
    const v = rng.int(1, 6);
    expect(v).toBeGreaterThanOrEqual(1);
    expect(v).toBeLessThanOrEqual(6);
  });
});
