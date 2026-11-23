/**
 * /api economy surface (STR/07 §0 "Game/store" REST list):
 *   - GET /api/leaderboard          — public, paginated, 60s cacheable
 *   - GET /api/me                   — authed profile (STR/09 derived read)
 *   - GET /api/me/profile           — alias (kept for W3 ritual; identical body)
 *
 * No route here grants anything — grants happen only via
 * `grantMatchRewards` (src/economy/grant.ts), which the game layer injects.
 */
import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import type { AppConfig } from '@liars-game/shared/server';
import { badRequest, jsonError } from '../lib/api.js';
import { createAuthMiddleware, type AuthMiddleware } from '../middleware/auth.js';
import {
  LEADERBOARD_METRICS,
  LEADERBOARD_PER_PAGE_DEFAULT,
  LEADERBOARD_PER_PAGE_MAX,
  fetchLeaderboard,
} from '../economy/leaderboard.js';
import { getProfile, ProfileNotFoundError } from '../economy/profile.js';

const LeaderboardQuery = z.strictObject({
  metric: z.enum(LEADERBOARD_METRICS).default('xp'),
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  perPage: z.coerce
    .number()
    .int()
    .min(1)
    .max(LEADERBOARD_PER_PAGE_MAX)
    .default(LEADERBOARD_PER_PAGE_DEFAULT),
});

export function createEconomyRouter(config: AppConfig): Router {
  const router = Router();
  const auth: AuthMiddleware = createAuthMiddleware(config.authSecret);

  router.get('/leaderboard', async (req: Request, res: Response): Promise<void> => {
    const query = LeaderboardQuery.safeParse(req.query);
    if (!query.success) {
      badRequest(res, query.error.issues);
      return;
    }
    const page = await fetchLeaderboard(query.data);
    res.set('Cache-Control', 'public, max-age=60');
    res.json(page);
  });

  const profileHandler = async (req: Request, res: Response): Promise<void> => {
    const sessionUser = req.user;
    if (!sessionUser) {
      jsonError(res, 401, 'AUTH_REQUIRED');
      return;
    }
    try {
      res.json(await getProfile(sessionUser.id));
    } catch (err) {
      // Ban flipped between requireAuth's read and ours — same story as 403.
      if (err instanceof ProfileNotFoundError) {
        jsonError(res, 404, 'USER_NOT_FOUND');
        return;
      }
      throw err;
    }
  };
  router.get('/me', auth.requireAuth, profileHandler);
  router.get('/me/profile', auth.requireAuth, profileHandler);

  return router;
}
