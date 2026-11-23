/**
 * Titles (STR/04 §6) — threshold matrix for cumulative stats.
 * "The House Always Wins" (execute the same player twice in one match) is
 * NOT unlockable from match_records stats — needs engine victim identity;
 * deliberately absent here (see titles.ts docblock + report).
 */
import { describe, expect, it } from 'vitest';
import {
  TITLES,
  TITLE_IDS,
  computeUnlockedTitles,
  type CumulativeStats,
} from '../../src/economy/titles.js';

const ZERO: CumulativeStats = {
  matches: 0,
  wins: 0,
  kills: 0,
  catches: 0,
  falseAccusations: 0,
  bluffSuccesses: 0,
  pullsSurvived: 0,
};

function statsWith(patch: Partial<CumulativeStats>): CumulativeStats {
  return { ...ZERO, ...patch };
}

describe('metric titles unlock exactly at their thresholds', () => {
  const metricCases: Array<[string, keyof CumulativeStats, number]> = [
    ['best-liar', 'bluffSuccesses', 50],
    ['smooth-talker', 'bluffSuccesses', 100],
    ['sharp-eye', 'catches', 25],
    ['lie-detector', 'catches', 100],
    ['dead-eye', 'kills', 10],
    ['grim-reaper', 'kills', 25],
    ['bar-legend', 'wins', 10],
    ['regular', 'matches', 50],
    ['cat-with-nine-lives', 'pullsSurvived', 9],
    ['chicken-dinner', 'falseAccusations', 1],
  ];

  for (const [id, metric, threshold] of metricCases) {
    it(`${id}: locked at ${threshold - 1}, unlocked at ${threshold} (${metric})`, () => {
      const def = TITLES.find((t) => t.id === id);
      expect(def).toBeDefined();
      const below = statsWith({ [metric]: threshold - 1 }) as CumulativeStats;
      const at = statsWith({ [metric]: threshold }) as CumulativeStats;
      expect(def?.unlocked(below)).toBe(false);
      expect(def?.unlocked(at)).toBe(true);
      expect(def?.progress(at)).toBe(threshold);
    });
  }
});

describe('composite titles', () => {
  it('honest-fool: ≥10 matches AND 0 bluffs (the recorded lies-played proxy)', () => {
    const def = TITLES.find((t) => t.id === 'honest-fool');
    expect(def).toBeDefined();
    expect(def?.unlocked(statsWith({ matches: 10, bluffSuccesses: 0 }))).toBe(true);
    expect(def?.unlocked(statsWith({ matches: 10, bluffSuccesses: 1 }))).toBe(false);
    expect(def?.unlocked(statsWith({ matches: 9, bluffSuccesses: 0 }))).toBe(false);
    expect(def?.progress(statsWith({ matches: 12, bluffSuccesses: 0 }))).toBe(12);
  });

  it('chicken-dinner is the fun-negative first-false-accusation title', () => {
    const def = TITLES.find((t) => t.id === 'chicken-dinner');
    expect(def?.name).toBe('Chicken Dinner?');
    expect(def?.unlocked(statsWith({ falseAccusations: 1 }))).toBe(true);
    expect(def?.unlocked(statsWith({}))).toBe(false);
  });
});

describe('computeUnlockedTitles', () => {
  it('returns nothing for a fresh player', () => {
    expect(computeUnlockedTitles(ZERO)).toEqual([]);
  });

  it('returns all 11 in STR/04 table order for maxed stats', () => {
    const maxed: CumulativeStats = {
      matches: 500,
      wins: 60,
      kills: 40,
      catches: 150,
      falseAccusations: 7,
      bluffSuccesses: 130,
      pullsSurvived: 20,
    };
    // bluffSuccesses > 0 disqualifies honest-fool by design (0 lies played).
    expect(computeUnlockedTitles(maxed).map((t) => t.id)).toEqual([
      'best-liar',
      'smooth-talker',
      'sharp-eye',
      'lie-detector',
      'dead-eye',
      'grim-reaper',
      'bar-legend',
      'regular',
      'cat-with-nine-lives',
      'chicken-dinner',
    ]);
  });

  it('defaults + sanitizes junk input (defensive stats row)', () => {
    expect(
      computeUnlockedTitles({
        matches: Number.NaN,
        wins: -3,
        kills: 'many' as unknown as number,
        catches: 25,
        falseAccusations: 0,
        bluffSuccesses: 0,
        pullsSurvived: 0,
      }).map((t) => t.id),
    ).toEqual(['sharp-eye']);
  });
});

describe('title registry integrity', () => {
  it('has 11 computable titles, unique ids, no engine-dependent ones', () => {
    expect(TITLES).toHaveLength(11);
    expect(new Set(TITLE_IDS).size).toBe(TITLE_IDS.length);
    expect(TITLE_IDS).not.toContain('the-house-always-wins');
  });
});
