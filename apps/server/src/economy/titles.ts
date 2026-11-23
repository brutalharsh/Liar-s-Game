/**
 * Titles — STR/04 §6. Threshold-based, computed server-side at match end
 * from cumulative stats (match_records aggregation via grant.ts).
 *
 * `title_progress` rows are the storage (STR/09); the unlock truth is the
 * cumulative stats, recomputed on every grant.
 *
 * NOT implementable from match_records stats (flagged for owner review):
 * "The House Always Wins" (execute the same player twice in one match)
 * needs executor→victim identity, which the engine's PlayerStats does not
 * record. It must come from a future engine stats field — deliberately
 * absent here rather than approximated.
 */
export interface CumulativeStats {
  matches: number;
  wins: number;
  kills: number;
  catches: number;
  falseAccusations: number;
  /** Unchallenged, unrevealed lies — the only "lies played" proxy recorded. */
  bluffSuccesses: number;
  pullsSurvived: number;
}

export interface TitleDef {
  id: string;
  name: string;
  metric: keyof CumulativeStats | 'honest' | null;
  threshold: number;
  unlocked(stats: CumulativeStats): boolean;
  /** Progress value toward `threshold` (stored in title_progress.progress). */
  progress(stats: CumulativeStats): number;
}

function metricTitle(
  id: string,
  name: string,
  metric: keyof CumulativeStats,
  threshold: number,
): TitleDef {
  return {
    id,
    name,
    metric,
    threshold,
    unlocked: (stats) => stats[metric] >= threshold,
    progress: (stats) => stats[metric],
  };
}

export const TITLES: readonly TitleDef[] = [
  metricTitle('best-liar', 'Best Liar', 'bluffSuccesses', 50),
  metricTitle('smooth-talker', 'Smooth Talker', 'bluffSuccesses', 100),
  metricTitle('sharp-eye', 'Sharp Eye', 'catches', 25),
  metricTitle('lie-detector', 'Lie Detector', 'catches', 100),
  metricTitle('dead-eye', 'Dead Eye', 'kills', 10),
  metricTitle('grim-reaper', 'Grim Reaper', 'kills', 25),
  metricTitle('bar-legend', 'Bar Legend', 'wins', 10),
  metricTitle('regular', 'Regular', 'matches', 50),
  {
    // "10 matches, 0 lies played" — 0 bluffSuccesses is the only lies-played
    // proxy the record carries (challenged lies are not credited to the
    // accused). Interpretation recorded in the E1 report.
    id: 'honest-fool',
    name: 'Honest Fool',
    metric: 'honest',
    threshold: 10,
    unlocked: (stats) => stats.matches >= 10 && stats.bluffSuccesses === 0,
    progress: (stats) => stats.matches,
  },
  metricTitle('cat-with-nine-lives', 'Cat With Nine Lives', 'pullsSurvived', 9),
  {
    // First false accusation — fun-negative (STR/04 §6).
    id: 'chicken-dinner',
    name: 'Chicken Dinner?',
    metric: 'falseAccusations',
    threshold: 1,
    unlocked: (stats) => stats.falseAccusations >= 1,
    progress: (stats) => stats.falseAccusations,
  },
];

export const TITLE_IDS: readonly string[] = TITLES.map((t) => t.id);

export function findTitle(id: string): TitleDef | undefined {
  return TITLES.find((t) => t.id === id);
}

/** All titles whose cumulative-stats threshold is met (order = STR/04 table). */
export function computeUnlockedTitles(stats: CumulativeStats): TitleDef[] {
  const safe: CumulativeStats = {
    matches: Math.max(0, Number(stats.matches) || 0),
    wins: Math.max(0, Number(stats.wins) || 0),
    kills: Math.max(0, Number(stats.kills) || 0),
    catches: Math.max(0, Number(stats.catches) || 0),
    falseAccusations: Math.max(0, Number(stats.falseAccusations) || 0),
    bluffSuccesses: Math.max(0, Number(stats.bluffSuccesses) || 0),
    pullsSurvived: Math.max(0, Number(stats.pullsSurvived) || 0),
  };
  return TITLES.filter((t) => t.unlocked(safe));
}
