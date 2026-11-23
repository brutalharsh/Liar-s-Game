/**
 * /api/auth — Discord + Google OAuth (login REQUIRED to play, STR/07 §0).
 *
 * Creds come from env; when a provider is not configured its routes answer
 * 503 {error:'OAUTH_NOT_CONFIGURED'} — missing creds NEVER crash boot.
 * Callbacks validate the one-time state cookie, exchange the code, upsert
 * the user, set the session, and redirect the web app to
 * `${clientOrigins[0]}/auth/callback?status=ok|error&reason=…` (the W-AUTH
 * wave builds that page).
 */
import { Router, type Request, type Response } from 'express';
import type { AppConfig } from '@liars-game/shared/server';
import { sanitizeNickname } from '@liars-game/shared';
import { randomBytes } from 'node:crypto';
import type { RateLimitRequestHandler } from 'express-rate-limit';
import type { FetchLike, OAuthCredentials, OAuthProfile } from '../lib/oauth.js';
import {
  buildDiscordAuthorizeUrl,
  buildGoogleAuthorizeUrl,
  createOAuthState,
  exchangeDiscordCode,
  exchangeGoogleCode,
  fetchDiscordProfile,
  fetchGoogleProfile,
  getDiscordOAuth,
  getGoogleOAuth,
  OAuthExchangeError,
} from '../lib/oauth.js';
import {
  ADMIN_ACTOR,
  OAUTH_STATE_COOKIE,
  cookieOptions,
  createAuthMiddleware,
  type AuthMiddleware,
} from '../middleware/auth.js';
import { writeAudit } from '../lib/audit.js';
import { User } from '../models/user.js';
import { jsonError } from '../lib/api.js';

export interface AuthRouterDeps {
  authLimiter?: RateLimitRequestHandler;
  fetchImpl?: FetchLike;
}

const CLIENT_HOME = (config: AppConfig): string => config.clientOrigins[0] ?? config.appUrl;

function redirectAuthResult(res: Response, config: AppConfig, status: string, reason?: string): void {
  const base = CLIENT_HOME(config);
  const params = new URLSearchParams({ status });
  if (reason) params.set('reason', reason);
  res.redirect(302, `${base}/auth/callback?${params.toString()}`);
}

function stateCookieOptions() {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
    maxAge: 10 * 60 * 1000,
    path: '/api/auth',
  };
}

/** Upserts an identity row; returns the user doc or null when banned. */
async function upsertUserFromProfile(profile: OAuthProfile) {
  const fallback = `Player ${randomBytes(2).toString('hex')}`;
  const nickname = sanitizeNickname(profile.name, { maxLength: 18 }) || fallback;
  const now = new Date();
  const set: Record<string, unknown> = { name: profile.name, lastSeenAt: now };
  if (profile.email) set['email'] = profile.email;
  if (profile.avatarUrl) set['avatarUrl'] = profile.avatarUrl;
  const doc = await User.findOneAndUpdate(
    { provider: profile.provider, providerId: profile.providerId },
    {
      $set: set,
      $setOnInsert: {
        nickname,
        avatarSpec: { base: 'default' },
        xp: 0,
        level: 1,
        role: 'user',
        banned: false,
        createdAt: now,
      },
    },
    { upsert: true, new: true },
  )
    .lean()
    .exec();
  return doc;
}

export function createAuthRouter(config: AppConfig, deps: AuthRouterDeps = {}): Router {
  const router = Router();
  const auth: AuthMiddleware = createAuthMiddleware(config.authSecret);
  const fetchImpl = deps.fetchImpl ?? globalThis.fetch;
  const limiter = deps.authLimiter ? [deps.authLimiter] : [];

  function beginOAuth(req: Request, res: Response, creds: OAuthCredentials | null, provider: 'discord' | 'google', redirectUri: string, buildUrl: (creds: OAuthCredentials, uri: string, state: string) => string): void {
    if (!creds) {
      res.status(503).json({ error: 'OAUTH_NOT_CONFIGURED', provider, message: `set ${provider === 'discord' ? 'DISCORD_CLIENT_ID' : 'GOOGLE_CLIENT_ID'} + secret in env` });
      return;
    }
    const state = createOAuthState();
    res.cookie(OAUTH_STATE_COOKIE, state, stateCookieOptions());
    res.redirect(302, buildUrl(creds, redirectUri, state));
  }

  // --- Discord ------------------------------------------------------------
  router.get('/discord', ...limiter, (req: Request, res: Response) => {
    const creds = getDiscordOAuth();
    beginOAuth(
      req,
      res,
      creds,
      'discord',
      `${config.appUrl}/api/auth/discord/callback`,
      buildDiscordAuthorizeUrl,
    );
  });

  router.get('/discord/callback', ...limiter, async (req: Request, res: Response): Promise<void> => {
    const stateCookie = (req.cookies as Record<string, string | undefined> | undefined)?.[
      OAUTH_STATE_COOKIE
    ];
    const queryState = typeof req.query['state'] === 'string' ? req.query['state'] : '';
    const providerDeny = typeof req.query['error'] === 'string' && req.query['error'].length > 0;
    if (providerDeny) return redirectAuthResult(res, config, 'error', 'denied');
    if (!stateCookie || !queryState || stateCookie !== queryState) {
      auth.clearStateCookie(res);
      return redirectAuthResult(res, config, 'error', 'state');
    }
    const code = typeof req.query['code'] === 'string' ? req.query['code'] : '';
    if (!code) return redirectAuthResult(res, config, 'error', 'code');
    const creds = getDiscordOAuth();
    if (!creds) return redirectAuthResult(res, config, 'error', 'not_configured');
    try {
      const accessToken = await exchangeDiscordCode(
        creds,
        code,
        `${config.appUrl}/api/auth/discord/callback`,
        fetchImpl,
      );
      const profile = await fetchDiscordProfile(accessToken, fetchImpl);
      const user = await upsertUserFromProfile(profile);
      auth.clearStateCookie(res);
      if (!user || user.banned === true) {
        return redirectAuthResult(res, config, 'error', 'banned');
      }
      auth.sessionCookie(String(user._id), res);
      redirectAuthResult(res, config, 'ok');
    } catch (err) {
      if (!(err instanceof OAuthExchangeError)) console.error('[auth] discord callback failure', err);
      return redirectAuthResult(res, config, 'error', 'exchange');
    }
  });

  // --- Google --------------------------------------------------------------
  router.get('/google', ...limiter, (req: Request, res: Response) => {
    const creds = getGoogleOAuth();
    beginOAuth(
      req,
      res,
      creds,
      'google',
      `${config.appUrl}/api/auth/google/callback`,
      buildGoogleAuthorizeUrl,
    );
  });

  router.get('/google/callback', ...limiter, async (req: Request, res: Response): Promise<void> => {
    const stateCookie = (req.cookies as Record<string, string | undefined> | undefined)?.[
      OAUTH_STATE_COOKIE
    ];
    const queryState = typeof req.query['state'] === 'string' ? req.query['state'] : '';
    if (!stateCookie || !queryState || stateCookie !== queryState) {
      auth.clearStateCookie(res);
      return redirectAuthResult(res, config, 'error', 'state');
    }
    const code = typeof req.query['code'] === 'string' ? req.query['code'] : '';
    if (!code) return redirectAuthResult(res, config, 'error', 'code');
    const creds = getGoogleOAuth();
    if (!creds) return redirectAuthResult(res, config, 'error', 'not_configured');
    try {
      const accessToken = await exchangeGoogleCode(
        creds,
        code,
        `${config.appUrl}/api/auth/google/callback`,
        fetchImpl,
      );
      const profile = await fetchGoogleProfile(accessToken, fetchImpl);
      const user = await upsertUserFromProfile(profile);
      auth.clearStateCookie(res);
      if (!user || user.banned === true) {
        return redirectAuthResult(res, config, 'error', 'banned');
      }
      auth.sessionCookie(String(user._id), res);
      redirectAuthResult(res, config, 'ok');
    } catch (err) {
      if (!(err instanceof OAuthExchangeError)) console.error('[auth] google callback failure', err);
      return redirectAuthResult(res, config, 'error', 'exchange');
    }
  });

  // --- Session surface ------------------------------------------------------
  router.get('/me', auth.requireAuth, async (req: Request, res: Response): Promise<void> => {
    // requireAuth guarantees req.user; the extra fields need a full read.
    const doc = await User.findById(req.user?.id).lean().exec();
    if (!doc) {
      jsonError(res, 401, 'AUTH_REQUIRED');
      return;
    }
    res.json({
      user: {
        id: String(doc._id),
        provider: doc.provider,
        name: doc.name,
        nickname: doc.nickname,
        email: doc.email ?? null,
        avatarUrl: doc.avatarUrl ?? null,
        avatarSpec: doc.avatarSpec ?? { base: 'default' },
        activeTitle: doc.activeTitle ?? null,
        level: doc.level,
        xp: doc.xp,
        banned: doc.banned,
        createdAt: doc.createdAt,
      },
    });
  });

  router.post('/logout', (req: Request, res: Response): void => {
    auth.clearSessionCookie(res);
    res.json({ ok: true });
  });

  return router;
}
