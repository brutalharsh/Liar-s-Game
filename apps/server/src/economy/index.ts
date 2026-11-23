/**
 * Economy + progression layer (E1). The seam S1's `registerGame` injects:
 *
 *   import { economy } from '../economy/index.js';   // apps/server/src/game/…
 *   // at game:over:
 *   economy.grantMatchRewards({ record, roomCode, seed, log, endedAt });
 *
 * Pure helpers (computeLevel/levelProgress/titles) are re-exported for W3's
 * profile screens and for tests. No IO in here beyond the modules above.
 */
export {
  grantMatchRewards,
  GrantPayloadError,
  EARN_EVENTS_PER_HOUR,
  type GrantMatchRewardsPayload,
  type GrantPlayerResult,
  type GrantPlayerStatus,
  type GrantSummary,
} from './grant.js';
export {
  computeLevel,
  levelProgress,
  xpForLevel,
  xpThroughLevel,
  LEVEL_MAX,
  XP_CURVE_K,
  XP_CURVE_RATE,
  XP_TO_REACH_LEVEL_100,
  type LevelProgress,
} from './levels.js';
export {
  TITLES,
  TITLE_IDS,
  computeUnlockedTitles,
  findTitle,
  type CumulativeStats,
  type TitleDef,
} from './titles.js';
export {
  LEADERBOARD_METRICS,
  LEADERBOARD_PER_PAGE_DEFAULT,
  LEADERBOARD_PER_PAGE_MAX,
  PUBLIC_USER_PROJECTION,
  clearLeaderboardCache,
  fetchLeaderboard,
  type LeaderboardEntry,
  type LeaderboardMetric,
  type LeaderboardPage,
} from './leaderboard.js';
export {
  getProfile,
  ProfileNotFoundError,
  RECENT_MATCH_RECORDS_LIMIT,
  type ProfileMatchRecord,
  type ProfileResponse,
  type ProfileUser,
} from './profile.js';

// Service object the game layer injects (identical shape to grantMatchRewards).
import { grantMatchRewards } from './grant.js';
export const economy = { grantMatchRewards };
export type EconomyService = typeof economy;
