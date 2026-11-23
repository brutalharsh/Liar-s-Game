/**
 * Level curve (STR/04 §5) — K = 733 with rate 1.0721: cumulative XP to reach
 * level 100 lands at 10,000,496 ≈ the spec's 10,000,000 target ≈ the owner's
 * 10-lakh-match grind at ~10 XP/match.
 */
import { describe, expect, it } from 'vitest';
import {
  LEVEL_MAX,
  XP_CURVE_K,
  XP_CURVE_RATE,
  XP_TO_REACH_LEVEL_100,
  computeLevel,
  levelProgress,
  xpForLevel,
  xpThroughLevel,
} from '../../src/economy/levels.js';

describe('level curve constants (STR/04 §5)', () => {
  it('uses the spec rate and a single recalibratable K', () => {
    expect(XP_CURVE_RATE).toBe(1.0721);
    expect(XP_CURVE_K).toBe(733);
    expect(LEVEL_MAX).toBe(100);
  });

  it('✅ lands cumulative XP to level 100 in the 10M ballpark (10-lakh check)', () => {
    // Exact solved value for K=733 (this IS the owner-grind calibration):
    expect(XP_TO_REACH_LEVEL_100).toBe(10_000_496);
    // Within ±0.01% of the STR/04 target of 10,000,000 XP.
    expect(Math.abs(XP_TO_REACH_LEVEL_100 - 10_000_000)).toBeLessThan(1_000);
    // At the spec's ~10 XP/match average → ≈ 1,000,050 matches ≈ 10 lakh.
    expect(Math.round(XP_TO_REACH_LEVEL_100 / 10)).toBe(1_000_050);
  });

  it('has 99 strictly positive steps (level 1→2 … 99→100)', () => {
    expect(xpForLevel(1)).toBe(733);
    expect(xpForLevel(100)).toBe(0); // no next level
    let previous = 0;
    for (let level = 1; level < LEVEL_MAX; level += 1) {
      const step = xpForLevel(level);
      expect(step).toBeGreaterThan(previous); // monotonic growth (1.0721^L-1)
      previous = step;
    }
  });
});

describe('computeLevel — exact boundaries', () => {
  it('level 1 is free; negatives clamp to 1', () => {
    expect(xpThroughLevel(1)).toBe(0);
    expect(computeLevel(0)).toBe(1);
    expect(computeLevel(-5)).toBe(1);
    expect(computeLevel(Number.NaN)).toBe(1);
  });

  it('level 1→2 boundary: 733 exactly (732 stays level 1)', () => {
    expect(xpThroughLevel(2)).toBe(733);
    expect(computeLevel(732)).toBe(1);
    expect(computeLevel(733)).toBe(2);
  });

  it('level 2→3 boundary: 1519 exactly (round(733·1.0721) = 786 step)', () => {
    expect(xpForLevel(2)).toBe(786);
    expect(xpThroughLevel(3)).toBe(1519);
    expect(computeLevel(1518)).toBe(2);
    expect(computeLevel(1519)).toBe(3);
  });

  it('level 99→100 boundary: 10,000,496 exactly — one XP short stays 99', () => {
    expect(xpThroughLevel(100)).toBe(10_000_496);
    expect(computeLevel(10_000_495)).toBe(99);
    expect(computeLevel(10_000_496)).toBe(100);
  });

  it('caps at 100 for any overflow (no level 101)', () => {
    expect(computeLevel(10_000_497)).toBe(100);
    expect(computeLevel(500_000_000)).toBe(100);
  });

  it('is monotonic across the whole range', () => {
    let level = 1;
    for (let xp = 0; xp <= XP_TO_REACH_LEVEL_100; xp += 977) {
      const computed = computeLevel(xp);
      expect(computed).toBeGreaterThanOrEqual(level);
      expect(computed).toBeLessThanOrEqual(100);
      level = computed;
    }
  });
});

describe('levelProgress (wire shape for the profile HUD)', () => {
  it('accepts a raw xp total or a {xp} user shape', () => {
    expect(levelProgress(733)).toEqual(levelProgress({ xp: 733 }));
  });

  it('mid level 2: xp 1000 → into 267, 519 to next, percent 34', () => {
    expect(levelProgress(1000)).toEqual({
      level: 2,
      xp: 1000,
      xpIntoLevel: 267,
      xpToNextLevel: 519,
      xpForLevel: 786,
      percent: 34,
      atMax: false,
    });
  });

  it('level 100 is atMax with null next-level fields', () => {
    const progress = levelProgress(10_001_000);
    expect(progress.atMax).toBe(true);
    expect(progress.level).toBe(100);
    expect(progress.xpToNextLevel).toBeNull();
    expect(progress.xpForLevel).toBeNull();
    expect(progress.percent).toBe(100);
  });

  it('never emits NaN for weird input', () => {
    const progress = levelProgress({ xp: Number.NaN });
    expect(progress.level).toBe(1);
    expect(progress.percent).toBe(0);
    expect(progress.xpToNextLevel).toBe(733);
  });
});
