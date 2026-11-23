/**
 * Discord + Google OAuth helpers (login REQUIRED to play — STR/08 §13).
 *
 * Creds live in the shared config's `oauth` group (loadConfig). Boot
 * (src/index.ts) owns the env-file load, so this re-reads the live
 * process.env per call without touching the fs. Any config failure degrades
 * to "not configured" — the auth routes answer 503 and missing creds never
 * crash a request (S-A1 behavior; loadConfig errors name KEY NAMES only).
 */
import { randomBytes } from 'node:crypto';
import { loadConfig } from '@liars-game/shared/server';
import type { OAuthConfig, OAuthCredentials } from '@liars-game/shared/server';

export type { OAuthCredentials };

export type FetchLike = (url: string, init?: RequestInit) => Promise<Response>;

export interface OAuthProfile {
  provider: 'discord' | 'google';
  providerId: string;
  name: string;
  email?: string;
  avatarUrl?: string;
}

export class OAuthExchangeError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = 'OAuthExchangeError';
  }
}

/** Read the shared config's optional `oauth` group; devolves to empty (503) on any config failure. */
function readOAuthGroup(): OAuthConfig {
  try {
    return loadConfig(process.env, { loadEnvFile: false }).oauth;
  } catch (err) {
    console.error(
      '[oauth] config unavailable — treating login as not configured:',
      err instanceof Error ? err.message : err,
    );
    return {};
  }
}

export function getDiscordOAuth(): OAuthCredentials | null {
  return readOAuthGroup().discord ?? null;
}

export function getGoogleOAuth(): OAuthCredentials | null {
  return readOAuthGroup().google ?? null;
}

/** One-time CSRF state (never Math.random — auth path). */
export function createOAuthState(): string {
  return randomBytes(24).toString('hex');
}

export function buildDiscordAuthorizeUrl(
  creds: OAuthCredentials,
  redirectUri: string,
  state: string,
): string {
  const params = new URLSearchParams({
    client_id: creds.clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'identify',
    state,
  });
  return `https://discord.com/api/oauth2/authorize?${params.toString()}`;
}

export function buildGoogleAuthorizeUrl(
  creds: OAuthCredentials,
  redirectUri: string,
  state: string,
): string {
  const params = new URLSearchParams({
    client_id: creds.clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'openid email profile',
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

async function readError(res: Response): Promise<string> {
  try {
    const data = (await res.json()) as { error?: unknown; error_description?: unknown };
    const message =
      typeof data?.error_description === 'string' ? data.error_description : data?.error;
    if (typeof message === 'string' && message.length > 0) {
      // Provider error text is echoed back to us only — never to the client.
      return message;
    }
  } catch {
    /* unparseable body */
  }
  return `status ${res.status}`;
}

export async function exchangeDiscordCode(
  creds: OAuthCredentials,
  code: string,
  redirectUri: string,
  fetchImpl: FetchLike = globalThis.fetch,
): Promise<string> {
  const body = new URLSearchParams({
    client_id: creds.clientId,
    client_secret: creds.clientSecret,
    grant_type: 'authorization_code',
    code,
    redirect_uri: redirectUri,
  });
  const res = await fetchImpl('https://discord.com/api/oauth2/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
  if (!res.ok) throw new OAuthExchangeError(`discord token exchange failed: ${await readError(res)}`, res.status);
  const data = (await res.json()) as { access_token?: string };
  if (typeof data?.access_token !== 'string' || !data.access_token) {
    throw new OAuthExchangeError('discord token exchange returned no access_token', res.status);
  }
  return data.access_token;
}

export async function fetchDiscordProfile(
  accessToken: string,
  fetchImpl: FetchLike = globalThis.fetch,
): Promise<OAuthProfile> {
  const res = await fetchImpl('https://discord.com/api/users/@me', {
    headers: { authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new OAuthExchangeError(`discord profile fetch failed: ${await readError(res)}`, res.status);
  const data = (await res.json()) as {
    id?: string;
    username?: string;
    global_name?: string;
    email?: string;
    avatar?: string;
  };
  const providerId = data?.id;
  if (typeof providerId !== 'string' || !providerId) {
    throw new OAuthExchangeError('discord profile missing id', res.status);
  }
  const avatarHash = data?.avatar;
  return {
    provider: 'discord',
    providerId,
    name: data?.global_name || data?.username || `Player ${providerId.slice(-4)}`,
    email: data?.email && data.email.includes('@') ? data.email : undefined,
    avatarUrl: avatarHash
      ? `https://cdn.discordapp.com/avatars/${providerId}/${avatarHash}.png`
      : undefined,
  };
}

export async function exchangeGoogleCode(
  creds: OAuthCredentials,
  code: string,
  redirectUri: string,
  fetchImpl: FetchLike = globalThis.fetch,
): Promise<string> {
  const body = new URLSearchParams({
    client_id: creds.clientId,
    client_secret: creds.clientSecret,
    grant_type: 'authorization_code',
    code,
    redirect_uri: redirectUri,
  });
  const res = await fetchImpl('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
  if (!res.ok) throw new OAuthExchangeError(`google token exchange failed: ${await readError(res)}`, res.status);
  const data = (await res.json()) as { access_token?: string };
  if (typeof data?.access_token !== 'string' || !data.access_token) {
    throw new OAuthExchangeError('google token exchange returned no access_token', res.status);
  }
  return data.access_token;
}

export async function fetchGoogleProfile(
  accessToken: string,
  fetchImpl: FetchLike = globalThis.fetch,
): Promise<OAuthProfile> {
  const res = await fetchImpl('https://www.googleapis.com/oauth2/v3/userinfo', {
    headers: { authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new OAuthExchangeError(`google profile fetch failed: ${await readError(res)}`, res.status);
  const data = (await res.json()) as {
    sub?: string;
    name?: string;
    email?: string;
    picture?: string;
  };
  const providerId = data?.sub;
  if (typeof providerId !== 'string' || !providerId) {
    throw new OAuthExchangeError('google profile missing sub', res.status);
  }
  return {
    provider: 'google',
    providerId,
    name: data?.name || `Player ${providerId.slice(-4)}`,
    email: data?.email && data.email.includes('@') ? data.email : undefined,
    avatarUrl: data?.picture,
  };
}
