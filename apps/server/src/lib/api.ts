/**
 * Small REST helpers: consistent {error: CODE} bodies, zod-parse-or-400.
 */
import type { Response } from 'express';
import type { z } from 'zod';

export function jsonError(
  res: Response,
  status: number,
  error: string,
  extra?: Record<string, unknown>,
): void {
  const body: Record<string, unknown> = { error };
  if (extra) {
    for (const [key, value] of Object.entries(extra)) body[key] = value;
  }
  res.status(status).json(body);
}

export function badRequest(res: Response, issues: readonly z.core.$ZodIssue[]): void {
  const first = issues[0];
  jsonError(res, 400, 'BAD_REQUEST', {
    message: first ? `${first.path.join('.')}: ${String(first.message)}` : 'invalid payload',
  });
}

/** zod parse helper that short-circuits BAD_REQUEST — returns null on failure. */
export function parseBody<T>(schema: z.ZodType<T>, data: unknown, res: Response): T | null {
  const result = schema.safeParse(data);
  if (!result.success) {
    badRequest(res, result.error.issues);
    return null;
  }
  return result.data;
}

/** Escapes user text before it becomes a RegExp (search injection guard). */
export function escapeRegExp(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
