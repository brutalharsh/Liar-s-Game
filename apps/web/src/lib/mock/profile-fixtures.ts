"use client";

/**
 * ============================================================================
 * PROFILE + LEADERBOARD MOCK PAYLOADS — TODO-sync-with-shared
 * ============================================================================
 * Mock implementations of the two E1 economy reads (STR/07 §0 "Game/store"):
 *
 *   GET /api/leaderboard?metric=wins|kills|xp|titles&page=&perPage=
 *   GET /api/me            (twin at /api/me/profile — identical body)
 *
 * Shapes are typed 1:1 by `src/lib/api.ts` (LeaderboardPage / ProfileResponse,
 * which mirror E1's server projection). Only active in mock mode
 * (`NEXT_PUBLIC_API_MODE=mock` or `?apimode=mock`); the live branch never
 * touches this module.
 *
 * The XP curve mirrors the server's exact math (STR/04 §5:
 * `xpForLevel(L) = round(K · 1.0721^(L-1))`, K=733 → 10,000,496 XP to L100)
 * so the mock viewer's levelProgress, the pool's xp-metric values and the
 * profile's "MAX LEVEL" demo state stay consistent with the real backend.
 *
 * Demo overrides beyond the shared ?mock=loading|empty|error set (handled by
 * mockFetch): `?mock=banned` → 403 BANNED profile, `?mock=max` → level-100
 * atMax profile. Nothing real in here: no service names, no URLs.
 * ============================================================================
 */

import {
  ApiError,
  type AdminAvatarSpec,
  type LeaderboardEntry,
  type LeaderboardMetric,
  type LeaderboardPage,
  type ProfileResponse,
} from "@/lib/api";
import { mockFetch } from "./api";
import { hasDemoViewer } from "./admin-fixtures";
import { seededRng, randInt } from "./rng";
import type { AvatarAnimal, ThemeId } from "@/lib/wire";

// ── XP & level curve (mirrors E1's src/economy/levels.ts — mock-only copy) ──

const LEVEL_MAX = 100;
const XP_CURVE_K = 733;
const XP_CURVE_RATE = 1.0721;

/** `STEP[L-1]` = XP to advance from level L to L+1 (99 entries). */
const STEP: readonly number[] = Array.from({ length: LEVEL_MAX - 1 }, (_, i) =>
  Math.round(XP_CURVE_K * Math.pow(XP_CURVE_RATE, i)),
);

/** `CUM[L-1]` = total XP required to REACH level L (CUM[99] = 10,000,496). */
const CUM: readonly number[] = (() => {
  const out: number[] = [0];
  let total = 0;
  for (const step of STEP) {
    total += step;
    out.push(total);
  }
  return out;
})();

/** Total XP needed to hit the ceiling (matches the server's 10,000,496). */
export const XP_TO_MAX: number = CUM[CUM.length - 1] as number;

/** Total XP standing at the start of `level` (1 → 0). */
export function xpThroughLevel(level: number): number {
  const clamped = Math.max(1, Math.min(LEVEL_MAX, Math.floor(level)));
  return CUM[clamped - 1] as number;
}

/** The canonical level (1–100) a player with `xp` total XP holds. */
export function levelFromXp(xp: number): number {
  if (!Number.isFinite(xp) || xp <= 0) return 1;
  let level = 1;
  while (level < LEVEL_MAX && xp >= (CUM[level] as number)) level += 1;
  return level;
}

/** Progress snapshot identical in shape+math to /api/me's `levelProgress`. */
export function levelProgressFromXp(xp: number): ProfileResponse["levelProgress"] {
  const safe = Number.isFinite(xp) && xp > 0 ? Math.round(xp) : 0;
  const level = levelFromXp(safe);
  const into = safe - (CUM[level - 1] as number);
  if (level >= LEVEL_MAX) {
    return { level, xp: safe, xpIntoLevel: into, xpToNextLevel: null, xpForLevel: null, percent: 100, atMax: true };
  }
  const step = STEP[level - 1] as number;
  const toNext = Math.max(0, step - into);
  const percent = step > 0 ? Math.min(100, Math.round((into / step) * 1000) / 10) : 0;
  return { level, xp: safe, xpIntoLevel: into, xpToNextLevel: toNext, xpForLevel: step, percent, atMax: false };
}

/** Deterministic xp partway into `level` (frac 0..1 of that level's step). */
function xpInto(level: number, frac: number): number {
  const base = xpThroughLevel(level);
  if (level >= LEVEL_MAX) return base;
  const step = STEP[level - 1] as number;
  return base + Math.round(step * Math.min(0.99, Math.max(0, frac)));
}

// ── deterministic clocks (fixtures render identically SSR + CSR) ────────────

const HOUR = 3_600_000;
const MOCK_NOW = Date.parse("2026-11-23T21:00:00Z");

function ts(hoursAgo: number): string {
  return new Date(MOCK_NOW - hoursAgo * HOUR).toISOString();
}

// ── room codes (STR/07 §5 — 31-char confusable-free charset, 5 chars) ────────

const CODE_CHARS = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

function roomCode(rng: () => number): string {
  let code = "";
  for (let i = 0; i < 5; i++) code += CODE_CHARS[Math.floor(rng() * CODE_CHARS.length)];
  return code;
}

// ── leaderboard pool (STR/09 derived read: users → per-metric aggregates) ────
// Public rows only — banned/deleted accounts are dropped before this layer on
// the real server, so the pool carries none. PII (email/provider) never enters.

interface PoolAccount {
  accountId: string;
  nickname: string;
  spec: AdminAvatarSpec | undefined;
  activeTitle: string | null;
  xp: number;
  wins: number;
  kills: number;
  titles: number;
}

interface PoolSeed {
  id: string;
  nick: string;
  animal: AvatarAnimal;
  level: number;
  /** Fraction of the current level's step already banked (0..1). */
  frac: number;
  /** E1 title id (server stores ids, not display names). */
  title: string | null;
  /** `undefined` mirrors "no avatarSpec on the account" (server omits the key). */
  spec?: Partial<AdminAvatarSpec>;
}

const POOL_SEEDS: readonly PoolSeed[] = [
  { id: "u-deadwood", nick: "DEADWOOD", animal: "wolf", level: 100, frac: 1, title: "bar-legend", spec: { hat: "hat-stetson", beard: "beard-longgrey", frame: "frame-vortex", anim: "anim-sway" } },
  { id: "u-morgana", nick: "MORGANA", animal: "cat", level: 71, frac: 0.62, title: "grim-reaper", spec: { hat: "hat-professor", glasses: "glasses-shades", hair: "hair-silver" } },
  { id: "u-thatcher", nick: "THATCHER", animal: "bear", level: 64, frac: 0.15, title: "lie-detector", spec: { beard: "beard-dock", shirt: "shirt-vest" } },
  { id: "u-wren", nick: "WREN", animal: "owl", level: 58, frac: 0.44, title: "smooth-talker", spec: { glasses: "glasses-monocle", shirt: "shirt-stringtie" } },
  { id: "u-cinder", nick: "CINDER", animal: "fox", level: 55, frac: 0.77, title: "best-liar", spec: { hat: "hat-feather", hair: "hair-ginger", anim: "anim-draw" } },
  { id: "u-slate", nick: "SLATE", animal: "boar", level: 52, frac: 0.31, title: "dead-eye", spec: { beard: "beard-stubble", shirt: "shirt-denim" } },
  { id: "u-orion", nick: "ORION", animal: "eagle", level: 49, frac: 0.55, title: "cat-with-nine-lives", spec: { hair: "hair-bleach", frame: "frame-ivory" } },
  { id: "u-blackjack", nick: "BLACKJACK", animal: "raccoon", level: 47, frac: 0.21, title: "sharp-eye", spec: { hat: "hat-bowler", glasses: "glasses-goggles" } },
  { id: "u-tuck", nick: "TUCK", animal: "gator", level: 44, frac: 0.49, title: "bar-legend", spec: { hat: "hat-newsboy" } },
  { id: "u-me", nick: "MAVERICK", animal: "fox", level: 42, frac: 0.38, title: "dead-eye", spec: { hat: "hat-stetson", shirt: "shirt-vest", frame: "frame-brass" } },
  { id: "u-moss", nick: "MOSS", animal: "deer", level: 39, frac: 0.66, title: null, spec: { hair: "hair-brunette", shirt: "shirt-cardsharp" } },
  { id: "u-echo", nick: "ECHO", animal: "snake", level: 37, frac: 0.12, title: "chicken-dinner", spec: { frame: "frame-mahogany", voicePack: "voice-whisper" } },
  { id: "u-grit", nick: "GRIT", animal: "wolf", level: 34, frac: 0.83, title: "regular", spec: { beard: "beard-incognito" } },
  { id: "u-fable", nick: "FABLE", animal: "rabbit", level: 31, frac: 0.27, title: "honest-fool", spec: {} },
  { id: "u-onyx", nick: "ONYX", animal: "cat", level: 28, frac: 0.58, title: "sharp-eye", spec: { glasses: "glasses-shades" } },
  { id: "u-juniper", nick: "JUNIPER", animal: "owl", level: 26, frac: 0.34, title: "chicken-dinner", spec: { glasses: "glasses-monocle" } },
  { id: "u-harlow", nick: "HARLOW", animal: "eagle", level: 23, frac: 0.71, title: "dead-eye", spec: { hat: "hat-feather" } },
  { id: "u-quill", nick: "QUILL", animal: "gator", level: 19, frac: 0.45, title: "regular", spec: { hat: "hat-professor" } },
  { id: "u-nutmeg", nick: "NUTMEG", animal: "raccoon", level: 15, frac: 0.19, title: null, spec: {} },
  { id: "u-fen", nick: "FEN", animal: "fox", level: 12, frac: 0.88, title: "chicken-dinner", spec: { hat: "hat-newsboy" } },
  { id: "u-lark", nick: "LARK", animal: "deer", level: 9, frac: 0.41, title: null, spec: { shirt: "shirt-hi-vis" } },
  { id: "u-pike", nick: "PIKE", animal: "boar", level: 6, frac: 0.52, title: null, spec: {} },
  { id: "u-tyke", nick: "TYKE", animal: "cat", level: 4, frac: 0.08, title: null, spec: {} },
  { id: "u-finch", nick: "FINCH", animal: "owl", level: 1, frac: 0.21, title: null, spec: {} },
  { id: "u-sprout", nick: "SPROUT", animal: "rabbit", level: 1, frac: 0.64, title: "chicken-dinner", spec: {} },
  { id: "u-bud", nick: "BUD", animal: "wolf", level: 1, frac: 0.9, title: null },
  { id: "u-dot", nick: "DOT", animal: "fox", level: 1, frac: 0.05, title: null, spec: {} },
];

function buildAccount(seed: PoolSeed): PoolAccount {
  const rng = seededRng("pool:" + seed.id);
  const xp = seed.level >= LEVEL_MAX ? XP_TO_MAX : xpInto(seed.level, seed.frac);
  // Career scale follows the STR/04 §5 grind: ~8.8 XP per completed match
  // (win 12 · survived 6 · died 4 mix) → the L100 legend sits near the owner's
  // 10-lakh-match figure. Wins/kills are per-player slices of that career.
  const matches = Math.max(1, Math.round(xp / randInt(rng, 7, 11)));
  const wins = seed.level >= LEVEL_MAX ? 214_377 : Math.round(matches * (0.05 + rng() * 0.16));
  const kills = seed.level >= LEVEL_MAX ? 683_140 : Math.round(matches * (0.18 + rng() * 0.5));
  const titles =
    seed.level >= LEVEL_MAX ? 11 : Math.max(0, Math.min(11, Math.round(seed.level * 0.11 + rng() * 1.5)));
  return {
    accountId: seed.id,
    nickname: seed.nick,
    spec: seed.spec === undefined ? undefined : { base: seed.animal, ...seed.spec },
    activeTitle: seed.title,
    xp,
    wins,
    kills,
    titles,
  };
}

const POOL: readonly PoolAccount[] = POOL_SEEDS.map(buildAccount);

function metricValue(account: PoolAccount, metric: LeaderboardMetric): number {
  switch (metric) {
    case "xp":
      return account.xp;
    case "wins":
      return account.wins;
    case "kills":
      return account.kills;
    case "titles":
      return account.titles;
  }
}

function boardFor(metric: LeaderboardMetric): PoolAccount[] {
  const ranked = POOL.slice().sort(
    (a, b) => metricValue(b, metric) - metricValue(a, metric) || a.accountId.localeCompare(b.accountId),
  );
  // titles rows only exist for players who actually unlocked one (the real
  // facet counts title_progress docs); the other metrics rank every account.
  // Filtering HERE keeps the rows and the pager's total derived from the
  // SAME list, so a 0-value titles row can never contradict the count.
  return metric === "titles" ? ranked.filter((a) => a.titles > 0) : ranked;
}

/** GET /api/leaderboard — mock branch consumed by getLeaderboard(). */
export const mockLeaderboard = {
  async page(metric: LeaderboardMetric, page: number, perPage: number): Promise<LeaderboardPage> {
    const ranked = boardFor(metric);
    const start = (page - 1) * perPage;
    const total = ranked.length;
    const leaderboard: LeaderboardEntry[] = ranked.slice(start, start + perPage).map((account, i) => ({
      accountId: account.accountId,
      nickname: account.nickname,
      ...(account.spec ? { avatarSpec: account.spec } : {}),
      activeTitle: account.activeTitle,
      level: levelFromXp(account.xp),
      rank: start + i + 1,
      value: metricValue(account, metric),
    }));
    return mockFetch<LeaderboardPage>(
      { metric, page, perPage, total, leaderboard },
      { minDelayMs: 360 },
    );
  },
};

// ── viewer profile (GET /api/me) ─────────────────────────────────────────────

/** Fixture-only demo doors, on top of the shared ?mock=loading|empty|error set. */
function readProfileDemo(): "banned" | "max" | null {
  if (typeof window === "undefined") return null;
  const raw = new URLSearchParams(window.location.search).get("mock");
  return raw === "banned" || raw === "max" ? raw : null;
}

const VIEWER_MATCH_THEMES: readonly ThemeId[] = [
  "saloon", "neon", "speakeasy", "royale", "house", "haunted", "orbital", "kabuki", "saloon", "house",
];

function viewerProfile(atMax: boolean): ProfileResponse {
  const xp = atMax ? XP_TO_MAX : xpInto(42, 0.38);
  const progress = levelProgressFromXp(xp);
  const rng = seededRng("recent:u-me");
  const unlockedTitleCount = atMax ? 11 : 5;

  // Last 10 completed matches, newest first — the first is a win so the demo
  // profile opens on a high note. Stats are one player's own line per record
  // (STR/09 match_records.players[you]; nothing about opponents' hidden cards).
  const records: ProfileResponse["recentMatchRecords"] = [];
  let clock = 6; // hours ago — lastSeen 3h fits inside this
  for (let i = 0; i < 10; i++) {
    const capacity = randInt(rng, 3, 7);
    const theme = VIEWER_MATCH_THEMES[i] ?? "saloon";
    const roll = i === 0 ? 0.1 : rng();
    const won = roll < 0.3;
    const died = !won && roll > 0.75;
    const rounds = randInt(rng, 3, 9);
    const kills = won || died ? randInt(rng, 0, 3) : randInt(rng, 0, 2);
    const pullsSurvived = died ? randInt(rng, 1, 5) : randInt(rng, 0, 4);
    records.push({
      matchId: `m-u-me-${String(203 - i)}`,
      roomCode: roomCode(rng),
      endedAt: ts(clock),
      capacity,
      theme,
      summary: {
        rounds,
        totalPulls: randInt(rng, Math.min(rounds, 2), rounds),
        dareDevilMoments: randInt(rng, 0, 3),
      },
      you: {
        seat: randInt(rng, 1, capacity),
        nickname: "MAVERICK",
        titleAtPlay: i < 4 ? "dead-eye" : "sharp-eye",
        stats: {
          kills,
          catches: randInt(rng, 0, 4),
          falseAccusations: died && rng() < 0.5 ? 1 : 0,
          bluffSuccesses: randInt(rng, 0, 5),
          deaths: died ? 1 : 0,
          pullsSurvived,
          roundsPlayed: rounds,
          won,
          xpEarned: won ? 12 : died ? 4 : 6,
          coinsEarned: won ? 3 + kills : died ? randInt(rng, 0, 1) : randInt(rng, 1, 3),
        },
      },
    });
    clock += randInt(rng, 5, 30);
  }

  return {
    user: {
      id: "u-me",
      nickname: "MAVERICK",
      name: "Maverick Doe",
      avatarUrl: null,
      avatarSpec: { base: "fox", hat: "hat-stetson", shirt: "shirt-vest", frame: "frame-brass" },
      activeTitle: atMax ? "bar-legend" : "dead-eye",
      role: "user",
      xp,
      level: progress.level,
      createdAt: ts(6_100),
      lastSeenAt: ts(3),
    },
    level: progress.level,
    levelProgress: progress,
    title: atMax ? "bar-legend" : "dead-eye",
    coins: 1_240,
    unlockedTitleCount,
    recentMatchRecords: records,
  };
}

/** GET /api/me — mock branch consumed by getProfile(). */
export const mockProfile = {
  async get(): Promise<ProfileResponse> {
    const demo = readProfileDemo();
    if (demo === "banned") {
      // mirrors the auth middleware's 403 {error: "BANNED"} envelope
      throw new ApiError("BANNED", "(403) The house has barred this account from the tables.", 403);
    }
    if (!hasDemoViewer()) {
      throw new ApiError("AUTH_REQUIRED", "(401) No session at this seat — sign in first.", 401);
    }
    return mockFetch<ProfileResponse>(viewerProfile(demo === "max"), { minDelayMs: 340 });
  },
};
