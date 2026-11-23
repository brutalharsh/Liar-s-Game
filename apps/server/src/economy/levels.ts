/**
 * XP & levels — STR/04 §5 (pure functions, zero IO).
 *
 * Curve: `xpForLevel(L) = round(K · 1.0721^(L-1))` — the cost of advancing
 * FROM level L to L+1; there are 99 steps (1→2 … 99→100). `K` is THE single
 * recalibration constant: K = 733 makes cumulative XP to reach level 100 =
 * 10,000,496 ≈ the spec's 10,000,000 XP target ≈ the owner's 10-lakh-match
 * grind at the spec's ~10 XP/match average (≈ 1,000,050 matches). Every 10
 * levels earns a prestige level frame (earned-only — granted by grant.ts,
 * never purchasable). No purchasable XP, no boosts, ever.
 */
export const LEVEL_MAX = 100;

/** Curve growth factor (STR/04 §5 — `1.0721^(L-1)`). */
export const XP_CURVE_RATE = 1.0721;

/** THE recalibration constant — cumulative XP to level 100 ≈ 10,000,000. */
export const XP_CURVE_K = 733;

/** Step cost array — `STEPS[L-1]` = XP needed to go from level L to L+1 (99 entries). */
const STEPS: readonly number[] = Array.from({ length: LEVEL_MAX - 1 }, (_, i) =>
  Math.round(XP_CURVE_K * Math.pow(XP_CURVE_RATE, i)),
);

/**
 * `CUMULATIVE[L-1]` = total XP required to REACH level L
 * (CUMULATIVE[0] = 0 → level 1 is free; CUMULATIVE[99] = 10,000,496 → level 100).
 */
const CUMULATIVE: readonly number[] = (() => {
  const out: number[] = [0];
  let total = 0;
  for (const step of STEPS) {
    total += step;
    out.push(total);
  }
  return out;
})();

/** Cumulative XP required just to reach level 100 (≈ 10,000,000 — STR/04 §5). */
export const XP_TO_REACH_LEVEL_100: number = CUMULATIVE[LEVEL_MAX - 1] as number;

/** Cost of advancing FROM level L to L+1. Clamped: ≥100 has no next step. */
export function xpForLevel(level: number): number {
  if (level < 1 || level >= LEVEL_MAX || !Number.isFinite(level)) return 0;
  return STEPS[level - 1] as number;
}

/** Total XP required to REACH `level` (1 → 0; 100 → 10,000,496). */
export function xpThroughLevel(level: number): number {
  const clamped = Math.max(1, Math.min(LEVEL_MAX, Math.floor(level)));
  return CUMULATIVE[clamped - 1] as number;
}

/** Compute the level (1–100) a user with `xp` total XP holds — canonical, capped at 100. */
export function computeLevel(xp: number): number {
  if (!Number.isFinite(xp) || xp <= 0) return 1;
  let level = 1;
  while (level < LEVEL_MAX && xp >= (CUMULATIVE[level] as number)) level += 1;
  return level;
}

/** Wire-friendly progress snapshot for the profile HUD (JSON-safe at level 100). */
export interface LevelProgress {
  /** Current level (canonical — computed from xp, never the stored column). */
  level: number;
  /** Total XP. */
  xp: number;
  /** XP credited since reaching `level`. */
  xpIntoLevel: number;
  /** Remaining XP to reach the next level; `null` at level 100. */
  xpToNextLevel: number | null;
  /** Current level's step cost (denominator of `percent`); `null` at level 100. */
  xpForLevel: number | null;
  /** Percent (0–100, one decimal) progress into the current level. */
  percent: number;
  /** True once level 100 is reached. */
  atMax: boolean;
}

/**
 * Progress toward the next level. Accepts a raw XP total or a `{xp}` user
 * shape — the profile endpoint passes the user doc, pure tests pass numbers.
 */
export function levelProgress(user: number | { xp?: number }): LevelProgress {
  const raw = typeof user === 'number' ? user : Number(user?.xp ?? 0);
  const xp = Number.isFinite(raw) && raw > 0 ? Math.round(raw) : 0;
  const level = computeLevel(xp);
  const into = xp - (CUMULATIVE[level - 1] as number);
  if (level >= LEVEL_MAX) {
    return { level, xp, xpIntoLevel: into, xpToNextLevel: null, xpForLevel: null, percent: 100, atMax: true };
  }
  const step = STEPS[level - 1] as number;
  const toNext = Math.max(0, step - into);
  const percent = step > 0 ? Math.min(100, Math.round((into / step) * 1000) / 10) : 0;
  return { level, xp, xpIntoLevel: into, xpToNextLevel: toNext, xpForLevel: step, percent, atMax: false };
}
