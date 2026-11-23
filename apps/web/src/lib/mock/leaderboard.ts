import type { AvatarAnimal } from "@/lib/wire";
import { seededRng, randInt } from "@/lib/mock/rng";
import { TITLES } from "@/lib/mock/titles";

/** Mock leaderboard rows (mirrors GET /api/leaderboard). */
export type LeaderboardMetric = "wins" | "kills" | "xp" | "titles";

export interface LeaderboardRow {
  playerId: string;
  nickname: string;
  avatar: AvatarAnimal;
  title: string;
  level: number;
  wins: number;
  kills: number;
  xp: number;
  titles: number;
}

const NAMES: readonly { name: string; animal: AvatarAnimal; title: string | null }[] = [
  { name: "TOAR", animal: "wolf", title: "Grim Reaper" },
  { name: "SUE", animal: "owl", title: "Lie Detector" },
  { name: "FOX", animal: "fox", title: "Best Liar" },
  { name: "BRIS", animal: "bear", title: "Bar Legend" },
  { name: "MIGO", animal: "deer", title: "Sharp Eye" },
  { name: "SCUBB", animal: "raccoon", title: "Regular" },
  { name: "LBLANC", animal: "gator", title: "Smooth Talker" },
  { name: "REX", animal: "boar", title: "Dead Eye" },
  { name: "MIA", animal: "cat", title: "Honest Fool" },
  { name: "OTTO", animal: "rabbit", title: "Chicken Dinner?" },
  { name: "VIPER", animal: "snake", title: "The House Always Wins" },
  { name: "HALEY", animal: "eagle", title: "Cat With Nine Lives" },
  { name: "JUNO", animal: "cat", title: "Best Liar" },
  { name: "PIERRE", animal: "boar", title: null },
  { name: "ADA", animal: "owl", title: "Sharp Eye" },
  { name: "BOONE", animal: "bear", title: null },
  { name: "RAZ", animal: "fox", title: "Chicken Dinner?" },
  { name: "NIA", animal: "deer", title: "Regular" },
  { name: "GUS", animal: "wolf", title: null },
  { name: "KOI", animal: "gator", title: "Dead Eye" },
];

export function makeLeaderboard(): LeaderboardRow[] {
  const rng = seededRng("leaderboard");
  return NAMES.map((entry, i) => {
    const wins = randInt(rng, 40 - i, 62 - i);
    return {
      playerId: `rank-${i + 1}`,
      nickname: entry.name,
      avatar: entry.animal,
      title: entry.title ?? (TITLES[randInt(rng, 0, TITLES.length - 1)]?.name ?? "Regular"),
      level: randInt(rng, 4 + (20 - i), 18 + (20 - i)),
      wins,
      kills: randInt(rng, 30 - i, 95 - i),
      xp: randInt(rng, 1200 + (20 - i) * 60, 5200 + (20 - i) * 90),
      titles: randInt(rng, 1, 4),
    };
  });
}

export function metricValue(row: LeaderboardRow, metric: LeaderboardMetric): number {
  switch (metric) {
    case "wins":
      return row.wins;
    case "kills":
      return row.kills;
    case "xp":
      return row.xp;
    case "titles":
      return row.titles;
  }
}

export const METRIC_LABELS: Record<LeaderboardMetric, { label: string; emoji: string }> = {
  wins: { label: "Wins", emoji: "🏆" },
  kills: { label: "Kills", emoji: "🔥" },
  xp: { label: "XP", emoji: "✨" },
  titles: { label: "Titles", emoji: "🎖️" },
};
