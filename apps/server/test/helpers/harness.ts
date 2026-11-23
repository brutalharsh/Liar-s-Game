/**
 * Test harness — in-process HTTP (127.0.0.1:0), fixture config, tiny mock
 * helpers. NO real network, NO real Mongo: models are mocked per test file.
 */
import http from 'node:http';
import type { Express, Request, Response, NextFunction, RequestHandler } from 'express';
import type { AppConfig, PaymentsConfig } from '@liars-game/shared/server';
import { vi } from 'vitest';

export const TEST_AUTH_SECRET = 'test-secret-0123456789abcdef';

export const MOCK_PAYMENTS: PaymentsConfig = { provider: 'mock' };

export const PROXY_PAYMENTS: PaymentsConfig = {
  provider: 'proxy',
  proxyUrl: 'http://payments.test',
  apiKey: 'pay-key',
  projectId: 'prj-pay',
  projectName: 'liars-game',
};

export const TEST_CONFIG: AppConfig = {
  mongodbUri: 'mongodb://localhost:27017/liars-game-test', // never connected in tests
  mongodbDb: 'liars-game-test',
  port: 0,
  clientOrigins: ['http://localhost:3100'],
  appUrl: 'http://localhost:3100',
  authSecret: TEST_AUTH_SECRET,
  adminUsername: 'envadmin',
  adminPassword: 'correct-horse-battery',
  imageServer: { url: 'http://images.test', key: 'img-key', projectId: 'prj-img' },
  payments: MOCK_PAYMENTS,
};

export const PROXY_TEST_CONFIG: AppConfig = {
  ...TEST_CONFIG,
  payments: PROXY_PAYMENTS,
};

export interface Listening {
  url: string;
  close(): Promise<void>;
}

export async function listen(app: Express): Promise<Listening> {
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
  const address = server.address();
  const port = typeof address === 'object' && address !== null ? address.port : 0;
  return {
    url: `http://127.0.0.1:${port}`,
    close(): Promise<void> {
      return new Promise<void>((resolve, reject) => {
        server.close((err) => (err ? reject(err) : resolve()));
      });
    },
  };
}

export interface TestResponse {
  status: number;
  headers: Headers;
  body: unknown;
}

export async function request(
  url: string,
  init: RequestInit & { raw?: string } = {},
): Promise<TestResponse> {
  const { raw, ...rest } = init;
  const res = await fetch(url, { redirect: 'manual', ...rest, body: raw ?? rest.body });
  const text = await res.text();
  let body: unknown = null;
  if (text.length > 0) {
    try {
      body = JSON.parse(text) as unknown;
    } catch {
      body = text;
    }
  }
  return { status: res.status, headers: res.headers, body };
}

export function json(rec: Record<string, unknown>): string {
  return JSON.stringify(rec);
}

/** Serializable fake rate limiter with an injectable window/limit. */
export function tinyLimiter(limit: number, windowMs = 60_000): RequestHandler {
  const hits = new Map<string, number[]>();
  return (req: Request, res: Response, next: NextFunction): void => {
    const key = req.ip ?? 'test';
    const now = Date.now();
    const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
    recent.push(now);
    hits.set(key, recent);
    if (recent.length > limit) {
      res.status(429).json({ error: 'RATE_LIMITED' });
      return;
    }
    next();
  };
}

/** Chainable mongoose query stub: .find/.select/.sort/.skip/.limit/.lean().exec(). */
export function makeQuery(rows: unknown[]): Record<string, unknown> {
  const promise = Promise.resolve(rows);
  const chain: Record<string, unknown> = {};
  const method = (): Record<string, unknown> => chain;
  for (const name of ['select', 'sort', 'skip', 'limit', 'lean', 'populate']) {
    chain[name] = vi.fn(method);
  }
  chain['exec'] = vi.fn(() => promise);
  chain['then'] = promise.then.bind(promise);
  chain['catch'] = promise.catch.bind(promise);
  return chain;
}

export function makeRaw(buffer: Buffer, contentType: string): RequestInit {
  return {
    method: 'POST',
    headers: { 'content-type': contentType },
    body: new Uint8Array(buffer),
  };
}
