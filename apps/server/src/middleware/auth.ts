/**
 * Session + admin auth middleware (STR/08 §13, STR/07 §0).
 *
 * Sessions: JWT `lg_session` httpOnly cookie (sameSite=lax, 7 days,
 * AUTH_SECRET, payload {sub: userId}). Admin: `lg_admin` cookie (8 hours,
 * payload {sub: 'env-admin', role: 'admin'}). Ban checks hit the DB on every
 * authenticated request — a ban kills access without waiting for token
 * expiry.
 *
 * Exported as a factory so S1 can reuse the same guards on sockets.
 */
import type { RequestHandler, Request, Response, NextFunction } from 'express';
import type { Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { User } from '../models/user.js';

export const SESSION_COOKIE = 'lg_session';
export const ADMIN_COOKIE = 'lg_admin';
export const OAUTH_STATE_COOKIE = 'lg_oauth_state';
export const SESSION_TTL_SECONDS = 7 * 24 * 60 * 60;
export const ADMIN_TTL_SECONDS = 8 * 60 * 60;
export const ADMIN_ACTOR = 'env-admin';

export interface SessionUser {
  id: string;
  nickname: string;
  email?: string;
  level: number;
  banned: boolean;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      /** Filled by requireAuth. */
      user?: SessionUser;
    }
  }
}

function isProduction(): boolean {
  return process.env.NODE_ENV === 'production';
}

export function cookieOptions(maxAgeSeconds: number) {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: isProduction(),
    maxAge: maxAgeSeconds * 1000,
    path: '/',
  };
}

function readSignedPayload(token: string, secret: string): Record<string, unknown> | null {
  try {
    const payload = jwt.verify(token, secret) as unknown;
    if (payload && typeof payload === 'object' && !Array.isArray(payload)) {
      return payload as Record<string, unknown>;
    }
    return null;
  } catch {
    return null;
  }
}

export type AuthMiddleware = {
  signSessionToken(userId: string): string;
  signAdminToken(): string;
  sessionCookie(userId: string, res: Response): void;
  adminCookie(res: Response): void;
  clearSessionCookie(res: Response): void;
  clearStateCookie(res: Response): void;
  verifySessionToken(token: string): string | null;
  verifyAdminToken(token: string): boolean;
  requireAuth: RequestHandler;
  requireAdmin: RequestHandler;
  /** Socket seam for S1: resolves the handshake cookie into a session user. */
  authenticateSocket(socket: Socket): Promise<SessionUser | null>;
};

/** Cookie header parsing without an extra dep (socket handshake path). */
export function parseCookieHeader(header: string | undefined, name: string): string | undefined {
  if (!header) return undefined;
  for (const part of header.split(';')) {
    const eq = part.indexOf('=');
    if (eq < 0) continue;
    if (part.slice(0, eq).trim() === name) {
      try {
        return decodeURIComponent(part.slice(eq + 1).trim());
      } catch {
        return part.slice(eq + 1).trim();
      }
    }
  }
  return undefined;
}

async function loadSessionUser(userId: string): Promise<SessionUser | null> {
  const doc = await User.findById(userId)
    .select('nickname email level banned')
    .lean()
    .exec();
  if (!doc) return null;
  return {
    id: String(doc._id),
    nickname: typeof doc.nickname === 'string' ? doc.nickname : 'Player',
    ...(typeof doc.email === 'string' ? { email: doc.email } : {}),
    level: typeof doc.level === 'number' ? doc.level : 1,
    banned: doc.banned === true,
  };
}

export function createAuthMiddleware(authSecret: string): AuthMiddleware {
  const signSessionToken = (userId: string): string =>
    jwt.sign({ sub: userId }, authSecret, { expiresIn: SESSION_TTL_SECONDS });

  const signAdminToken = (): string =>
    jwt.sign({ sub: ADMIN_ACTOR, role: 'admin' }, authSecret, { expiresIn: ADMIN_TTL_SECONDS });

  const verifySessionToken = (token: string): string | null => {
    const payload = readSignedPayload(token, authSecret);
    const sub = payload?.['sub'];
    return typeof sub === 'string' && sub.length > 0 ? sub : null;
  };

  const verifyAdminToken = (token: string): boolean => {
    const payload = readSignedPayload(token, authSecret);
    return payload?.['sub'] === ADMIN_ACTOR && payload?.['role'] === 'admin';
  };

  const requireAuth: RequestHandler = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    const cookies = req.cookies as Record<string, string | undefined> | undefined;
    const token = cookies?.[SESSION_COOKIE];
    if (typeof token !== 'string' || token.length === 0 || !verifySessionToken(token)) {
      res.status(401).json({ error: 'AUTH_REQUIRED' });
      return;
    }
    const userId = verifySessionToken(token);
    const user = userId ? await loadSessionUser(userId) : null;
    if (!user) {
      res.status(401).json({ error: 'AUTH_REQUIRED' });
      return;
    }
    if (user.banned) {
      res.status(403).json({ error: 'BANNED' });
      return;
    }
    req.user = user;
    next();
  };

  const requireAdmin: RequestHandler = (req: Request, res: Response, next: NextFunction): void => {
    const cookies = req.cookies as Record<string, string | undefined> | undefined;
    const token = cookies?.[ADMIN_COOKIE];
    if (typeof token !== 'string' || token.length === 0 || !verifyAdminToken(token)) {
      res.status(401).json({ error: 'ADMIN_REQUIRED' });
      return;
    }
    next();
  };

  return {
    signSessionToken,
    signAdminToken,

    sessionCookie(userId: string, res: Response): void {
      res.cookie(SESSION_COOKIE, signSessionToken(userId), cookieOptions(SESSION_TTL_SECONDS));
    },

    adminCookie(res: Response): void {
      res.cookie(ADMIN_COOKIE, signAdminToken(), cookieOptions(ADMIN_TTL_SECONDS));
    },

    clearSessionCookie(res: Response): void {
      res.clearCookie(SESSION_COOKIE, cookieOptions(SESSION_TTL_SECONDS));
    },

    clearStateCookie(res: Response): void {
      res.clearCookie(OAUTH_STATE_COOKIE, { httpOnly: true, sameSite: 'lax', path: '/api/auth' });
    },

    verifySessionToken,
    verifyAdminToken,
    requireAuth,
    requireAdmin,

    async authenticateSocket(socket: Socket): Promise<SessionUser | null> {
      const header = socket.request.headers.cookie;
      const token = parseCookieHeader(header, SESSION_COOKIE);
      if (!token) return null;
      const userId = verifySessionToken(token);
      if (!userId) return null;
      const user = await loadSessionUser(userId);
      if (!user || user.banned) return null;
      return user;
    },
  };
}
