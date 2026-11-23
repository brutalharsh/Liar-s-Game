/**
 * Leaderboard service — STR/09 "Derived reads": `GET /api/leaderboard?
 * metric=wins|kills|xp|titles`, aggregation over match_records / users /
 * title_progress, cached 60s. Rows match @liars-game/shared's
 * LeaderboardRowSchema (accountId, nickname, avatarSpec?, activeTitle?,
 * level?, rank, value) — an EXPLICIT public projection: email/provider/
 * providerId never enter the pipeline output.
 */
import { User } from '../models/user.js';
import { MatchRecord as MatchRecordModel } from '../models/match-record.js';
import { TitleProgress } from './models/title-progress.js';

export const LEADERBOARD_METRICS = ['wins', 'kills', 'xp', 'titles'] as const;
export type LeaderboardMetric = (typeof LEADERBOARD_METRICS)[number];

export const LEADERBOARD_PER_PAGE_DEFAULT = 20;
export const LEADERBOARD_PER_PAGE_MAX = 50;

/** Explicit public display projection — PII never selected, never emitted. */
export const PUBLIC_USER_PROJECTION = 'nickname avatarSpec activeTitle level banned';

const CACHE_TTL_MS = 60_000;

export interface LeaderboardEntry {
  accountId: string;
  nickname: string;
  avatarSpec?: unknown;
  activeTitle?: string | null;
  level?: number;
  rank: number;
  value: number;
}

export interface LeaderboardPage {
  metric: LeaderboardMetric;
  page: number;
  perPage: number;
  total: number;
  leaderboard: LeaderboardEntry[];
}

interface PublicUserRow {
  _id: unknown;
  nickname?: unknown;
  avatarSpec?: unknown;
  activeTitle?: unknown;
  level?: unknown;
  banned?: unknown;
  xp?: unknown;
}

interface MetricRow {
  _id: unknown;
  value: unknown;
}

const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0);

function str(v: unknown, fallback: string): string {
  return typeof v === 'string' && v.length > 0 ? v : fallback;
}

// In-process cache (single-process v1 deploys — STR/06 §4), key = metric:page.
const cache = new Map<string, { expires: number; page: LeaderboardPage }>();

export function clearLeaderboardCache(): void {
  cache.clear();
}

/** Display enrichment for aggregated metric rows — drops missing/banned users. */
async function enrichMetricRows(
  rows: MetricRow[],
  offset: number,
): Promise<LeaderboardEntry[]> {
  const ids = rows.map((r) => r._id).filter((id) => id !== null && id !== undefined);
  const users =
    ids.length > 0
      ? ((await User.find({ _id: { $in: ids }, banned: { $ne: true } })
          .select('nickname avatarSpec activeTitle level')
          .lean()
          .exec()) as PublicUserRow[])
      : [];
  const byAccountId = new Map<string, PublicUserRow>();
  for (const u of users) byAccountId.set(String(u._id), u);

  const entries: LeaderboardEntry[] = [];
  let rank = offset + 1;
  for (const row of rows) {
    const accountId = String(row._id);
    const user = byAccountId.get(accountId);
    if (!user) continue; // deleted or banned — never displayed
    entries.push({
      accountId,
      nickname: str(user.nickname, 'Player'),
      ...(user.avatarSpec !== undefined && user.avatarSpec !== null
        ? { avatarSpec: user.avatarSpec }
        : {}),
      activeTitle: typeof user.activeTitle === 'string' ? user.activeTitle : null,
      level: typeof user.level === 'number' ? user.level : 1,
      rank,
      value: num(row.value),
    });
    rank += 1;
  }
  return entries;
}

async function xpLeaderboard(page: number, perPage: number): Promise<LeaderboardPage> {
  const offset = (page - 1) * perPage;
  const total = num(await User.countDocuments({ banned: { $ne: true } }).exec());
  const rows = (await User.find({ banned: { $ne: true } })
    .select('nickname avatarSpec activeTitle level xp')
    .sort({ xp: -1, _id: 1 })
    .skip(offset)
    .limit(perPage)
    .lean()
    .exec()) as PublicUserRow[];
  const leaderboard: LeaderboardEntry[] = rows.map((row, i) => ({
    accountId: String(row._id),
    nickname: str(row.nickname, 'Player'),
    ...(row.avatarSpec !== undefined && row.avatarSpec !== null
      ? { avatarSpec: row.avatarSpec }
      : {}),
    activeTitle: typeof row.activeTitle === 'string' ? row.activeTitle : null,
    level: typeof row.level === 'number' ? row.level : 1,
    rank: offset + i + 1,
    value: num(row.xp),
  }));
  return { metric: 'xp', page, perPage, total, leaderboard };
}

interface FacetResult {
  rows?: MetricRow[];
  total?: Array<{ count?: unknown }>;
}

async function aggregateLeaderboard(
  metric: Exclude<LeaderboardMetric, 'xp'>,
  page: number,
  perPage: number,
): Promise<LeaderboardPage> {
  const offset = (page - 1) * perPage;

  // One $facet call per metric: page rows + distinct-account total.
  let facets;
  if (metric === 'titles') {
    facets = await TitleProgress.aggregate<FacetResult>([
      { $group: { _id: '$accountId', value: { $sum: 1 } } },
      { $sort: { value: -1 } },
      {
        $facet: {
          rows: [{ $skip: offset }, { $limit: perPage }],
          total: [{ $count: 'count' }],
        },
      },
    ]).exec();
  } else {
    const metricSum =
      metric === 'wins'
        ? { $sum: { $cond: [{ $eq: ['$players.stats.won', true] }, 1, 0] } }
        : { $sum: '$players.stats.kills' };
    facets = await MatchRecordModel.aggregate<FacetResult>([
      { $unwind: '$players' },
      { $group: { _id: '$players.accountId', value: metricSum } },
      { $sort: { value: -1 } },
      {
        $facet: {
          rows: [{ $skip: offset }, { $limit: perPage }],
          total: [{ $count: 'count' }],
        },
      },
    ]).exec();
  }

  const result = facets[0];
  const total = num(result?.total?.[0]?.count);
  const leaderboard = await enrichMetricRows(result?.rows ?? [], offset);
  return { metric, page, perPage, total, leaderboard };
}

export async function fetchLeaderboard(params: {
  metric: LeaderboardMetric;
  page: number;
  perPage: number;
}): Promise<LeaderboardPage> {
  const { metric, page, perPage } = params;
  const key = `${metric}:${page}:${perPage}`;
  const hit = cache.get(key);
  if (hit && hit.expires > Date.now()) return hit.page;

  const built =
    metric === 'xp'
      ? await xpLeaderboard(page, perPage)
      : await aggregateLeaderboard(metric, page, perPage);
  cache.set(key, { expires: Date.now() + CACHE_TTL_MS, page: built });
  return built;
}
