/**
 * Server-side env/config loader — imported ONLY via `@liars-game/shared/server`.
 * (The web app must never pull this in: it touches `node:fs` + dotenv.)
 *
 * Env-file convention (AGENTS.md rule 5, STR/06 §5):
 *   - `NODE_ENV === 'production'` → repo-root `.env.production`
 *   - otherwise                    → `.env.local`, falling back to `.env`
 *   - `LIARS_ENV_FILE` always overrides; `options.envFile` overrides that (tests)
 *   - only `.env.example` is committed
 *
 * Fails fast with errors listing missing KEY NAMES only — values (secrets,
 * admin credentials, keys) are never logged or echoed (STR/08 §10).
 */
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { config as loadDotenv } from 'dotenv';

export type PaymentsProvider = 'mock' | 'proxy';

export interface PaymentsConfig {
  provider: PaymentsProvider;
  /** Hosted payment proxy — present only when provider is 'proxy'. */
  proxyUrl?: string;
  apiKey?: string;
  projectId?: string;
  projectName?: string;
}

export interface ImageServerConfig {
  url: string;
  key: string;
  projectId: string;
}

export interface OAuthCredentials {
  clientId: string;
  clientSecret: string;
}

/**
 * Login providers (STR/08 §13) — purely OPTIONAL: a provider appears only
 * when BOTH its env keys are filled; an absent group simply means login is
 * not configured and the auth routes answer 503 (S-A1 behavior).
 */
export interface OAuthConfig {
  discord?: OAuthCredentials;
  google?: OAuthCredentials;
}

export interface AppConfig {
  mongodbUri: string;
  mongodbDb: string;
  port: number;
  /** CORS origins (CLIENT_ORIGIN may be a comma-separated list for tunnel playtests). */
  clientOrigins: string[];
  appUrl: string;
  authSecret: string;
  adminUsername: string;
  adminPassword: string;
  oauth: OAuthConfig;
  imageServer: ImageServerConfig;
  payments: PaymentsConfig;
}

export interface LoadConfigOptions {
  /** Explicit env-file path — highest priority (tests). Default: LIARS_ENV_FILE or the NODE_ENV rule. */
  envFile?: string;
  /** Default: load the env file only when reading the real process.env. */
  loadEnvFile?: boolean;
  /** Directory to walk up from when locating the env file. Defaults to process.cwd(). */
  cwd?: string;
}

const CORE_REQUIRED_KEYS = [
  'APP_URL',
  'AUTH_SECRET',
  'ADMIN_USERNAME',
  'ADMIN_PASSWORD',
  'MONGODB_URI',
  'MONGODB_DB',
  'PORT',
  'CLIENT_ORIGIN',
  'IMAGE_SERVER_URL',
  'IMAGE_SERVER_KEY',
  'IMAGE_SERVER_PROJECT_ID',
  'PAYMENTS_PROVIDER',
] as const;

const PROXY_REQUIRED_KEYS = [
  'PAYMENT_PROXY_URL',
  'PAYMENT_API_KEY',
  'PROJECT_ID',
  'PROJECT_NAME',
] as const;

const MAX_WALK_UP = 8;

function isFilled(value: string | undefined): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isHttpUrl(value: string | undefined): value is string {
  return typeof value === 'string' && /^https?:\/\//.test(value.trim());
}

/** Walks up from `startDir` looking for `fileName` (env files live at the repo root; npm -w sets CWD to the workspace). */
function findEnvFile(startDir: string, fileName: string): string | undefined {
  let dir = startDir;
  for (let i = 0; i < MAX_WALK_UP && dir; i += 1) {
    const candidate = join(dir, fileName);
    if (existsSync(candidate)) return candidate;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return undefined;
}

/**
 * Pure name selection per the NODE_ENV rule (no fs): ['.env.production'] for
 * production; ['.env.local', '.env'] otherwise.
 */
export function candidateEnvFiles(env: NodeJS.ProcessEnv): readonly string[] {
  return env['NODE_ENV'] === 'production' ? ['.env.production'] : ['.env.local', '.env'];
}

/**
 * Resolves which env file to load: `options.envFile` > `LIARS_ENV_FILE` >
 * first existing candidate per the NODE_ENV rule, walking up from CWD.
 * Exported for tests + server diagnostics. Never returns values — paths only.
 */
export function resolveEnvFile(
  env: NodeJS.ProcessEnv = process.env,
  options: LoadConfigOptions = {},
): string | undefined {
  if (options.envFile) return options.envFile;
  const override = env['LIARS_ENV_FILE'];
  if (isFilled(override)) return override;
  const cwd = options.cwd ?? process.cwd();
  for (const fileName of candidateEnvFiles(env)) {
    const found = findEnvFile(cwd, fileName);
    if (found) return found;
  }
  return undefined;
}

function listMissing(env: NodeJS.ProcessEnv, keys: readonly string[]): string[] {
  return keys.filter((key) => !isFilled(env[key]));
}

/** Returns a filled value or throws naming the key (never the value). */
function requireFilled(env: NodeJS.ProcessEnv, key: string): string {
  const value = env[key];
  if (!isFilled(value)) {
    throw new Error(`[config] ${key} is required but empty.`);
  }
  return value;
}

function assertHttpUrl(env: NodeJS.ProcessEnv, key: string): string {
  const value = env[key];
  if (!isHttpUrl(value)) {
    throw new Error(`[config] ${key} must be an http(s):// URL.`);
  }
  return value.trim();
}

/**
 * Optional OAuth credentials — a provider is configured only when BOTH its
 * keys are filled. Never throws: absent or partial pairs stay "not
 * configured" (the auth routes answer 503 — S-A1 behavior).
 */
function optionalOAuthProvider(
  env: NodeJS.ProcessEnv,
  idKey: 'DISCORD_CLIENT_ID' | 'GOOGLE_CLIENT_ID',
  secretKey: 'DISCORD_CLIENT_SECRET' | 'GOOGLE_CLIENT_SECRET',
): OAuthCredentials | undefined {
  const clientId = env[idKey]?.trim();
  const clientSecret = env[secretKey]?.trim();
  if (!isFilled(clientId) || !isFilled(clientSecret)) return undefined;
  return { clientId, clientSecret };
}

/**
 * Loads + validates the game server config. Throws a single aggregated error
 * naming the missing keys (names only — never values).
 */
export function loadConfig(
  env: NodeJS.ProcessEnv = process.env,
  options: LoadConfigOptions = {},
): AppConfig {
  const shouldLoadEnvFile = options.loadEnvFile ?? env === process.env;
  if (shouldLoadEnvFile) {
    const envFile = resolveEnvFile(env, options);
    if (envFile) {
      loadDotenv({ path: envFile, quiet: true });
    }
  }

  const missing = listMissing(env, CORE_REQUIRED_KEYS);
  if (missing.length > 0) {
    throw new Error(
      `[config] Missing required environment variables: ${missing.join(', ')}. ` +
        'Copy .env.example to .env.local (dev) or .env.production (prod) at the repo root and fill them in (values are never printed).',
    );
  }

  const port = Number(env['PORT']);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('[config] PORT must be an integer between 1 and 65535.');
  }

  const clientOrigins = (env['CLIENT_ORIGIN'] ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);
  if (clientOrigins.length === 0 || clientOrigins.some((o) => !isHttpUrl(o))) {
    throw new Error(
      '[config] CLIENT_ORIGIN must be one or more http(s):// origins (comma-separated).',
    );
  }

  const appUrl = assertHttpUrl(env, 'APP_URL');

  const mongodbUri = env['MONGODB_URI'];
  if (!mongodbUri || !/^mongodb(\+srv)?:\/\//.test(mongodbUri)) {
    throw new Error('[config] MONGODB_URI must be a mongodb:// or mongodb+srv:// connection string.');
  }
  const mongodbDb = env['MONGODB_DB'];
  if (!mongodbDb || mongodbDb.trim().length === 0) {
    throw new Error('[config] MONGODB_DB must be a non-empty database name.');
  }
  const imageServerUrl = assertHttpUrl(env, 'IMAGE_SERVER_URL');

  // Payments: 'mock' credits nothing. 'proxy' runs through the hosted payment
  // proxy (server-only keys; amounts always verified server-side — AGENTS.md rule 8).
  const provider = env['PAYMENTS_PROVIDER'];
  if (provider !== 'mock' && provider !== 'proxy') {
    throw new Error("[config] PAYMENTS_PROVIDER must be 'mock' or 'proxy'.");
  }
  let payments: PaymentsConfig = { provider };
  if (provider === 'proxy') {
    const missingPayments = listMissing(env, PROXY_REQUIRED_KEYS);
    if (missingPayments.length > 0) {
      throw new Error(
        `[config] PAYMENTS_PROVIDER=proxy requires: ${missingPayments.join(', ')}. ` +
          'Get them from the owner — values are never printed.',
      );
    }
    const proxyUrl = assertHttpUrl(env, 'PAYMENT_PROXY_URL');
    payments = {
      provider,
      proxyUrl,
      apiKey: requireFilled(env, 'PAYMENT_API_KEY'),
      projectId: requireFilled(env, 'PROJECT_ID'),
      projectName: requireFilled(env, 'PROJECT_NAME'),
    };
  }

  return {
    mongodbUri,
    mongodbDb,
    port,
    clientOrigins,
    appUrl,
    authSecret: requireFilled(env, 'AUTH_SECRET'),
    adminUsername: requireFilled(env, 'ADMIN_USERNAME'),
    adminPassword: requireFilled(env, 'ADMIN_PASSWORD'),
    oauth: {
      discord: optionalOAuthProvider(env, 'DISCORD_CLIENT_ID', 'DISCORD_CLIENT_SECRET'),
      google: optionalOAuthProvider(env, 'GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET'),
    },
    imageServer: {
      url: imageServerUrl,
      key: requireFilled(env, 'IMAGE_SERVER_KEY'),
      projectId: requireFilled(env, 'IMAGE_SERVER_PROJECT_ID'),
    },
    payments,
  };
}
