import { describe, expect, it } from 'vitest';
import { isExpired, remainingMs } from '../src/timers.js';

describe('timers', () => {
  it('remainingMs computes time left and clamps at zero', () => {
    expect(remainingMs(1_000, 400)).toBe(600);
    expect(remainingMs(1_000, 1_000)).toBe(0);
    expect(remainingMs(1_000, 2_000)).toBe(0); // never negative
  });

  it('isExpired treats the deadline instant as expired (inclusive)', () => {
    expect(isExpired(1_000, 999)).toBe(false);
    expect(isExpired(1_000, 1_000)).toBe(true);
    expect(isExpired(1_000, 1_001)).toBe(true);
  });
});
