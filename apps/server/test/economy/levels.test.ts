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

// ─────────────────────────────────────────────────────────────────────────────
// A8 edge audit — level-up boundaries must never be off-by-one, anywhere
// ─────────────────────────────────────────────────────────────────────────────

describe('A8 — levelProgress / computeLevel at EVERY cumulative boundary', () => {
  it('each level L (1..100): exactly xpThroughLevel(L) → level L, xpIntoLevel 0, percent 0', () => {
    for (let level = 1; level <= LEVEL_MAX; level += 1) {
      const at = xpThroughLevel(level);
      expect(computeLevel(at)).toBe(level);
      const p = levelProgress(at);
      expect(p.level).toBe(level);
      expect(p.xpIntoLevel).toBe(0); // AT the boundary — not one XP into it
      if (level < LEVEL_MAX) {
        expect(p.atMax).toBe(false);
        expect(p.percent).toBe(0);
        expect(p.xpToNextLevel).toBe(xpForLevel(level));
        expect(p.xpForLevel).toBe(xpForLevel(level));
        // One XP past the boundary: same level, one XP credited into it.
        expect(computeLevel(at + 1)).toBe(level);
        expect(levelProgress(at + 1).xpIntoLevel).toBe(1);
      } else {
        expect(p.atMax).toBe(true);
        expect(p.percent).toBe(100);
        expect(p.xpToNextLevel).toBeNull();
        expect(p.xpForLevel).toBeNull();
      }
    }
  });

  it('one XP short of levels 2..100 stays on the PREVIOUS level with xpToNextLevel 1', () => {
    for (let level = 2; level <= LEVEL_MAX; level += 1) {
      const p = levelProgress(xpThroughLevel(level) - 1);
      expect(p.level).toBe(level - 1);
      expect(p.xpToNextLevel).toBe(1); // the classic off-by-one regression
      expect(p.atMax).toBe(false);
      expect(p.xpIntoLevel).toBe(xpForLevel(level - 1) - 1);
    }
  });

  it('the XP_TO_REACH_LEVEL_100 invariant is the level-100 boundary (never 99)', () => {
    expect(computeLevel(XP_TO_REACH_LEVEL_100)).toBe(100);
    const atMax = levelProgress(XP_TO_REACH_LEVEL_100);
    expect(atMax.level).toBe(100);
    expect(atMax.atMax).toBe(true);
    expect(atMax.xpIntoLevel).toBe(0);
    // One XP short of the invariant → still 99, exactly 1 to go.
    expect(computeLevel(XP_TO_REACH_LEVEL_100 - 1)).toBe(99);
    expect(levelProgress(XP_TO_REACH_LEVEL_100 - 1).xpToNextLevel).toBe(1);
  });
});
