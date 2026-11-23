/**
 * Titles (STR/04 §6) — earned server-side at match end; equipped one at a time.
 * Reconciled 1:1 with the server registry (apps/server/src/economy/titles.ts);
 * "The House Always Wins" is deferred engine-side and deliberately absent.
 */

export interface TitleMeta {
  id: string;
  name: string;
  unlock: string;
}

export const TITLES: readonly TitleMeta[] = [
  { id: "best-liar", name: "Best Liar", unlock: "50 bluffs unchallenged" },
  { id: "smooth-talker", name: "Smooth Talker", unlock: "100 bluffs unchallenged" },
  { id: "sharp-eye", name: "Sharp Eye", unlock: "25 catches" },
  { id: "lie-detector", name: "Lie Detector", unlock: "100 catches" },
  { id: "dead-eye", name: "Dead Eye", unlock: "10 kills" },
  { id: "grim-reaper", name: "Grim Reaper", unlock: "25 kills" },
  { id: "bar-legend", name: "Bar Legend", unlock: "10 wins" },
  { id: "regular", name: "Regular", unlock: "50 matches" },
  { id: "honest-fool", name: "Honest Fool", unlock: "10 matches, zero lies played" },
  { id: "cat-with-nine-lives", name: "Cat With Nine Lives", unlock: "9 trigger pulls survived" },
  { id: "chicken-dinner", name: "Chicken Dinner?", unlock: "first false accusation" },
] as const;

export function titleName(id: string | null | undefined): string | null {
  if (!id) return null;
  return TITLES.find((t) => t.id === id)?.name ?? null;
}
