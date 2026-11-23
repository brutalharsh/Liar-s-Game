import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { candidateEnvFiles, loadConfig, resolveEnvFile } from '../src/config.js';

const validEnv = {
  APP_URL: 'http://localhost:3000',
  AUTH_SECRET: 'auth-secret-value-0123456789abcdef',
  ADMIN_USERNAME: 'admin',
  ADMIN_PASSWORD: 'admin-password-value',
  MONGODB_URI: 'mongodb+srv://user:supersecret@cluster.mongodb.net/',
  MONGODB_DB: 'liars-game',
  PORT: '3001',
  CLIENT_ORIGIN: 'http://localhost:3000',
  IMAGE_SERVER_URL: 'https://images.example.com',
  IMAGE_SERVER_KEY: 'image-key-value',
  IMAGE_SERVER_PROJECT_ID: 'image-project',
  PAYMENTS_PROVIDER: 'mock',
};

describe('loadConfig', () => {
  it('returns a typed config for a complete mock env', () => {
    const config = loadConfig({ ...validEnv }, { loadEnvFile: false });
    expect(config.mongodbDb).toBe('liars-game');
    expect(config.port).toBe(3001);
    expect(config.clientOrigins).toEqual(['http://localhost:3000']);
    expect(config.appUrl).toBe('http://localhost:3000');
    expect(config.authSecret).toBe('auth-secret-value-0123456789abcdef');
    expect(config.adminUsername).toBe('admin');
    expect(config.imageServer).toEqual({
      url: 'https://images.example.com',
      key: 'image-key-value',
      projectId: 'image-project',
    });
    expect(config.payments).toEqual({ provider: 'mock' });
  });

  it('lists missing KEY NAMES — never values', () => {
    const env: NodeJS.ProcessEnv = {
      ...validEnv,
      MONGODB_URI: 'supersecret://credential',
      MONGODB_DB: undefined,
      PORT: undefined,
      AUTH_SECRET: undefined,
      ADMIN_PASSWORD: undefined,
      IMAGE_SERVER_KEY: undefined,
    };
    try {
      loadConfig(env, { loadEnvFile: false });
      expect.unreachable('loadConfig should have thrown');
    } catch (err) {
      const error = err as Error;
      expect(error.message).toContain('MONGODB_DB');
      expect(error.message).toContain('PORT');
      expect(error.message).toContain('AUTH_SECRET');
      expect(error.message).toContain('ADMIN_PASSWORD');
      expect(error.message).toContain('IMAGE_SERVER_KEY');
      expect(error.message).not.toContain('MONGODB_URI'); // key present → not listed
      expect(error.message).not.toContain('supersecret'); // values NEVER echoed
      expect(error.message).not.toContain('image-key-value');
    }
  });

  it('rejects non-integer / out-of-range PORT', () => {
    for (const bad of ['nope', '0', '-1', '99999']) {
      expect(() => loadConfig({ ...validEnv, PORT: bad }, { loadEnvFile: false })).toThrow(/PORT/);
    }
  });

  it('requires http(s) schemes for the URL-typed keys, without echoing values', () => {
    const badUrlCases: Array<[key: string, value: string]> = [
      ['APP_URL', 'localhost:3000'],
      ['IMAGE_SERVER_URL', 'ftp://images.example.com'],
      ['CLIENT_ORIGIN', 'localhost:3000'],
    ];
    for (const [key, value] of badUrlCases) {
      try {
        loadConfig({ ...validEnv, [key]: value }, { loadEnvFile: false });
        expect.unreachable('loadConfig should have thrown');
      } catch (err) {
        const error = err as Error;
        expect(error.message).toContain(key);
        expect(error.message).not.toContain(value);
      }
    }
  });

  it('rejects wrong MONGODB_URI schemes without echoing the string', () => {
    const env: NodeJS.ProcessEnv = { ...validEnv, MONGODB_URI: 'postgres://inner-secret@host/db' };
    try {
      loadConfig(env, { loadEnvFile: false });
      expect.unreachable('loadConfig should have thrown');
    } catch (err) {
      const error = err as Error;
      expect(error.message).toContain('MONGODB_URI');
      expect(error.message).not.toContain('inner-secret');
    }
  });

  it('parses comma-separated CLIENT_ORIGIN lists (tunnel playtests)', () => {
    const config = loadConfig(
      { ...validEnv, CLIENT_ORIGIN: 'http://localhost:3000,https://dev.example.com' },
      { loadEnvFile: false },
    );
    expect(config.clientOrigins).toEqual(['http://localhost:3000', 'https://dev.example.com']);
  });
});

describe('payments provider validation', () => {
  const proxyEnv: NodeJS.ProcessEnv = {
    ...validEnv,
    PAYMENTS_PROVIDER: 'proxy',
    PAYMENT_PROXY_URL: 'https://payment-proxy.example',
    PAYMENT_API_KEY: 'test-api-key',
    PROJECT_ID: 'test-project-id',
    PROJECT_NAME: 'Liar Game',
  };

  it('accepts mock without any payment keys', () => {
    const config = loadConfig(
      { ...validEnv, PAYMENT_API_KEY: undefined, PROJECT_ID: undefined },
      { loadEnvFile: false },
    );
    expect(config.payments).toEqual({ provider: 'mock' });
  });

  it('accepts proxy provider with all four keys and exposes them under payments', () => {
    const config = loadConfig(proxyEnv, { loadEnvFile: false });
    expect(config.payments).toEqual({
      provider: 'proxy',
      proxyUrl: 'https://payment-proxy.example',
      apiKey: 'test-api-key',
      projectId: 'test-project-id',
      projectName: 'Liar Game',
    });
  });

  it('proxy with missing keys: lists the names, never the values', () => {
    const env: NodeJS.ProcessEnv = {
      ...proxyEnv,
      PAYMENT_PROXY_URL: 'https://proxy-secret.example',
      PAYMENT_API_KEY: 'secret-key-present',
      PROJECT_ID: undefined,
      PROJECT_NAME: undefined,
    };
    try {
      loadConfig(env, { loadEnvFile: false });
      expect.unreachable('loadConfig should have thrown');
    } catch (err) {
      const error = err as Error;
      expect(error.message).toContain('PROJECT_ID');
      expect(error.message).toContain('PROJECT_NAME');
      expect(error.message).not.toContain('PAYMENT_PROXY_URL'); // present → not listed
      expect(error.message).not.toContain('PAYMENT_API_KEY');
      expect(error.message).not.toContain('secret');
    }
  });

  it('rejects unknown providers without echoing the given value', () => {
    try {
      loadConfig({ ...validEnv, PAYMENTS_PROVIDER: 'razorpay' }, { loadEnvFile: false });
      expect.unreachable('loadConfig should have thrown');
    } catch (err) {
      const error = err as Error;
      expect(error.message).toContain("'mock'");
      expect(error.message).toContain("'proxy'");
      expect(error.message).not.toContain('razorpay');
    }
  });

  it('proxy provider URLs must be http(s) URLs', () => {
    expect(() =>
      loadConfig({ ...proxyEnv, PAYMENT_PROXY_URL: 'not-a-url' }, { loadEnvFile: false }),
    ).toThrow(/PAYMENT_PROXY_URL/);
  });
});

describe('oauth provider parsing (optional — absent pair = not configured)', () => {
  it('yields an empty group when none of the four keys are set', () => {
    const config = loadConfig({ ...validEnv }, { loadEnvFile: false });
    expect(config.oauth).toEqual({});
  });

  it('exposes a provider only when BOTH its keys are filled (trimmed)', () => {
    const config = loadConfig(
      {
        ...validEnv,
        DISCORD_CLIENT_ID: '  discord-id  ',
        DISCORD_CLIENT_SECRET: 'discord-secret',
        GOOGLE_CLIENT_ID: 'google-id',
      },
      { loadEnvFile: false },
    );
    expect(config.oauth.discord).toEqual({ clientId: 'discord-id', clientSecret: 'discord-secret' });
    expect(config.oauth.google).toBeUndefined(); // secret missing → not configured
  });

  it('treats whitespace-only values as absent (503, never a crash)', () => {
    const config = loadConfig(
      { ...validEnv, DISCORD_CLIENT_ID: '   ', DISCORD_CLIENT_SECRET: 'discord-secret' },
      { loadEnvFile: false },
    );
    expect(config.oauth).toEqual({});
  });
});

describe('env-file selection (AGENTS.md rule 5)', () => {
  let tmp: string;

  beforeAll(() => {
    tmp = mkdtempSync(join(tmpdir(), 'liars-shared-config-'));
  });

  afterAll(() => {
    rmSync(tmp, { recursive: true, force: true });
  });

  it('candidate names: production picks only .env.production; dev prefers .env.local then .env', () => {
    expect(candidateEnvFiles({ NODE_ENV: 'production' })).toEqual(['.env.production']);
    expect(candidateEnvFiles({ NODE_ENV: 'development' })).toEqual(['.env.local', '.env']);
    expect(candidateEnvFiles({})).toEqual(['.env.local', '.env']);
  });

  it('production mode resolves .env.production (never falls back to dev files)', () => {
    writeFileSync(join(tmp, '.env.local'), 'PORT=9998\n');
    expect(resolveEnvFile({ NODE_ENV: 'production' }, { cwd: tmp })).toBeUndefined();
    writeFileSync(join(tmp, '.env.production'), 'PORT=9997\n');
    expect(resolveEnvFile({ NODE_ENV: 'production' }, { cwd: tmp })).toBe(join(tmp, '.env.production'));
  });

  it('dev mode prefers .env.local, falling back to .env', () => {
    const devTmp = mkdtempSync(join(tmpdir(), 'liars-shared-dev-'));
    try {
      writeFileSync(join(devTmp, '.env'), 'PORT=9996\n');
      expect(resolveEnvFile({}, { cwd: devTmp })).toBe(join(devTmp, '.env'));
      writeFileSync(join(devTmp, '.env.local'), 'PORT=9995\n');
      expect(resolveEnvFile({ NODE_ENV: 'development' }, { cwd: devTmp })).toBe(join(devTmp, '.env.local'));
    } finally {
      rmSync(devTmp, { recursive: true, force: true });
    }
  });

  it('LIARS_ENV_FILE beats the NODE_ENV candidates; options.envFile beats everything', () => {
    expect(resolveEnvFile({ NODE_ENV: 'production', LIARS_ENV_FILE: '/custom/.env.ci' })).toBe(
      '/custom/.env.ci',
    );
    expect(
      resolveEnvFile({ NODE_ENV: 'production', LIARS_ENV_FILE: '/custom/.env.ci' }, { envFile: '/opt/.env' }),
    ).toBe('/opt/.env');
  });

  it('does not read any env file when an explicit env object is given', () => {
    // The repo root has real env files — an injected env must remain authoritative.
    const config = loadConfig({ ...validEnv, PORT: '5555' }, { loadEnvFile: false });
    expect(config.port).toBe(5555);
  });
});
