/**
 * Env-trio convention + full config shape (shared's loadConfig — the server
 * consumes it directly; no local env module anywhere in apps/server).
 */
import { describe, it, expect } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { candidateEnvFiles, loadConfig, resolveEnvFile } from '@liars-game/shared/server';

const BASE_ENV: Record<string, string> = {
  APP_URL: 'http://localhost:3100',
  AUTH_SECRET: 'a'.repeat(32),
  ADMIN_USERNAME: 'envadmin',
  ADMIN_PASSWORD: 'pw',
  MONGODB_URI: 'mongodb+srv://user:pass@cluster.test/',
  MONGODB_DB: 'liars-game',
  PORT: '3001',
  CLIENT_ORIGIN: 'http://localhost:3100,http://localhost:3200',
  IMAGE_SERVER_URL: 'http://images.test',
  IMAGE_SERVER_KEY: 'img-key-value',
  IMAGE_SERVER_PROJECT_ID: 'prj-img',
  PAYMENTS_PROVIDER: 'mock',
};

describe('env trio convention (NODE_ENV rule)', () => {
  it('picks .env.production under NODE_ENV=production', () => {
    expect(candidateEnvFiles({ NODE_ENV: 'production' })).toEqual(['.env.production']);
  });

  it('picks .env.local first, falling back to .env, in dev', () => {
    expect(candidateEnvFiles({})).toEqual(['.env.local', '.env']);
  });

  it('resolves .env.production from the repo walk-up in production', () => {
    const dir = mkdtempSync(join(tmpdir(), 'lg-env-prod-'));
    try {
      writeFileSync(join(dir, '.env.production'), 'APP_URL=http://x\n');
      const found = resolveEnvFile({ NODE_ENV: 'production' }, { cwd: dir });
      expect(found).toBeDefined();
      expect(String(found).endsWith('.env.production')).toBe(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('resolves .env.local over .env in dev', () => {
    const dir = mkdtempSync(join(tmpdir(), 'lg-env-dev-'));
    try {
      writeFileSync(join(dir, '.env.local'), 'APP_URL=http://x\n');
      writeFileSync(join(dir, '.env'), 'APP_URL=http://y\n');
      const found = resolveEnvFile({ NODE_ENV: 'development' }, { cwd: dir });
      expect(String(found).endsWith('.env.local')).toBe(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('falls back to .env when .env.local is missing', () => {
    const dir = mkdtempSync(join(tmpdir(), 'lg-env-fallback-'));
    try {
      writeFileSync(join(dir, '.env'), 'APP_URL=http://y\n');
      const found = resolveEnvFile({}, { cwd: dir });
      expect(String(found).endsWith('.env')).toBe(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('honors LIARS_ENV_FILE as an explicit override', () => {
    const found = resolveEnvFile({ LIARS_ENV_FILE: '/tmp/custom.env' }, { cwd: '/nonexistent' });
    expect(found).toBe('/tmp/custom.env');
  });
});

describe('loadConfig full shape', () => {
  it('parses every field the server consumes (mock provider)', () => {
    const config = loadConfig({ ...BASE_ENV }, { loadEnvFile: false });
    expect(config.appUrl).toBe('http://localhost:3100');
    expect(config.authSecret).toBe('a'.repeat(32));
    expect(config.adminUsername).toBe('envadmin');
    expect(config.adminPassword).toBe('pw');
    expect(config.port).toBe(3001);
    expect(config.clientOrigins).toEqual(['http://localhost:3100', 'http://localhost:3200']);
    expect(config.imageServer).toEqual({
      url: 'http://images.test',
      key: 'img-key-value',
      projectId: 'prj-img',
    });
    expect(config.payments).toEqual({ provider: 'mock' });
  });

  it("exposes every proxy field only when provider === 'proxy'", () => {
    const env: Record<string, string> = {
      ...BASE_ENV,
      PAYMENTS_PROVIDER: 'proxy',
      PAYMENT_PROXY_URL: 'http://payments.test',
      PAYMENT_API_KEY: 'pay-key',
      PROJECT_ID: 'prj-pay',
      PROJECT_NAME: 'liars-game',
    };
    const config = loadConfig(env, { loadEnvFile: false });
    expect(config.payments.provider).toBe('proxy');
    expect(config.payments.proxyUrl).toBe('http://payments.test');
    expect(config.payments.apiKey).toBe('pay-key');
    expect(config.payments.projectId).toBe('prj-pay');
    expect(config.payments.projectName).toBe('liars-game');
  });

  it('names missing KEY NAMES only (never values)', () => {
    const env: Record<string, string> = { ...BASE_ENV };
    delete env['AUTH_SECRET'];
    delete env['IMAGE_SERVER_KEY'];
    try {
      loadConfig(env, { loadEnvFile: false });
      expect.unreachable('loadConfig should have thrown');
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      expect(message).toContain('AUTH_SECRET');
      expect(message).toContain('IMAGE_SERVER_KEY');
      expect(message).not.toContain('a'.repeat(32)); // a real secret value
      expect(message).not.toContain('img-key-value');
    }
  });

  it("requires the proxy keys when PAYMENTS_PROVIDER === 'proxy'", () => {
    const env: Record<string, string> = { ...BASE_ENV, PAYMENTS_PROVIDER: 'proxy' };
    try {
      loadConfig(env, { loadEnvFile: false });
      expect.unreachable('loadConfig should have thrown');
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      expect(message).toContain('PAYMENT_API_KEY');
      expect(message).toContain('PROJECT_ID');
      expect(message).toContain('PROJECT_NAME');
      expect(message).toContain('PAYMENT_PROXY_URL');
    }
  });

  it("rejects unknown provider values", () => {
    const env: Record<string, string> = { ...BASE_ENV, PAYMENTS_PROVIDER: 'other' };
    expect(() => loadConfig(env, { loadEnvFile: false })).toThrow(/PAYMENTS_PROVIDER/);
  });

  it('allows nested subdirectory fixtures to walk up to the env file', () => {
    const root = mkdtempSync(join(tmpdir(), 'lg-env-walk-'));
    const nested = join(root, 'apps', 'server');
    mkdirSync(nested, { recursive: true });
    try {
      writeFileSync(join(root, '.env.local'), 'APP_URL=http://z\n');
      const found = resolveEnvFile({ NODE_ENV: 'development' }, { cwd: nested });
      expect(String(found)).toBe(join(root, '.env.local'));
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
