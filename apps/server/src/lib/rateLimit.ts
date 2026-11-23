/**
 * Rate-limit factories (STR/07 §0, STR/08 §13): login 5/15min, admin surface
 * 30/min, auth 20/min, billing 10/min. Tests inject tiny-window limiters via
 * AppDeps so the real windows never slow the suite.
 */
import rateLimit, { type RateLimitRequestHandler } from 'express-rate-limit';

export interface LimiterSet {
  login: RateLimitRequestHandler;
  admin: RateLimitRequestHandler;
  auth: RateLimitRequestHandler;
  billing: RateLimitRequestHandler;
}

export type LimiterOverrides = Partial<LimiterSet>;

const baseOptions = {
  standardHeaders: 'draft-8' as const,
  legacyHeaders: false,
  message: { error: 'RATE_LIMITED' },
};

export function createDefaultLimiters(): LimiterSet {
  return {
    login: rateLimit({ ...baseOptions, windowMs: 15 * 60 * 1000, limit: 5 }),
    admin: rateLimit({ ...baseOptions, windowMs: 60 * 1000, limit: 30 }),
    auth: rateLimit({ ...baseOptions, windowMs: 60 * 1000, limit: 20 }),
    billing: rateLimit({ ...baseOptions, windowMs: 60 * 1000, limit: 10 }),
  };
}
