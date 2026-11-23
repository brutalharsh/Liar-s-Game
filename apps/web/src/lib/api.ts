/**
 * ============================================================================
 * REST API CLIENT — TODO-sync-with-shared
 * ============================================================================
 * typed fetch client for the STR/07 §0 REST surface (auth / admin / billing /
 * store). When `@liars-game/shared` grows REST schemas, the wire types below
 * should be re-exported from there instead of declared here.
 *
 * - credentials: 'include' everywhere — sessions are httpOnly cookies (STR/08
 *   §13); no token is EVER stored client-side (no localStorage).
 * - errors normalize to the shared ack envelope: {ok:false, error:{code,message}}
 *   → `ApiError {error, message, status}`. 401 surfaces as code AUTH_REQUIRED,
 *   which the auth store consumes (guest).
 * - mock/live adapter: `NEXT_PUBLIC_API_MODE` (default mock in dev, live in
 *   production) with a per-tab override via `?apimode=mock|live`. Mock mode is
 *   served entirely from `@/lib/mock/admin-fixtures` (STR/09 shapes) so every
 *   screen is clickable before the server lands.
 * ============================================================================
 */

import {
  mockAuth,
  mockAdmin,
  mockBilling,
  mockCatalog,
  mockUpload,
  validateUpload,
} from "@/lib/mock/admin-fixtures";
import { mockLeaderboard, mockProfile } from "@/lib/mock/profile-fixtures";

// ══════════════════════════════ wire types ══════════════════════════════════

export type AuthProvider = "discord" | "google";

/** GET /api/auth/me — the session probe (lean; the profile page owns the full /api/me). */
export interface AuthMe {
  id: string;
  provider: AuthProvider;
  name: string;
  nickname: string;
  avatarUrl?: string;
  avatarSpec?: AdminAvatarSpec | null;
  level: number;
  coinBalance: number;
}

/** STR/09 `users.avatarSpec` — category-checked server-side, display here. */
export interface AdminAvatarSpec {
  base: string;
  hair?: string;
  beard?: string;
  hat?: string;
  shirt?: string;
  glasses?: string;
  frame?: string;
  anim?: string;
  voicePack?: string;
}

/** STR/09 `users` row + derived read-model extras the admin table renders. */
export interface AdminUser {
  _id: string;
  provider: AuthProvider;
  providerId: string;
  email?: string;
  name: string;
  nickname: string;
  role: "user" | "admin";
  banned: boolean;
  banReason?: string;
  avatarSpec: AdminAvatarSpec | null;
  activeTitle?: string;
  xp: number;
  nextLevelXp: number;
  level: number;
  createdAt: string;
  lastSeenAt: string;
  /** Derived server-side from `wallet_ledger` (balance is never client-authored). */
  coinBalance: number;
  matchCount: number;
}

export interface AdminUsersPage {
  users: AdminUser[];
  page: number;
  pageSize: number;
  total: number;
}

/** STR/09 `wallet_ledger` — append-only; balance derived. */
export interface WalletLedgerEntry {
  _id: string;
  accountId: string;
  delta: number;
  reason: "win" | "survived_round" | "purchase" | "spend" | "adjust";
  refId: string;
  txId: string;
  at: string;
}

export type CheckoutStatus = "created" | "paid" | "failed" | "expired";

/** STR/09 `checkouts` (+ userNickname join for the admin browser). */
export interface CheckoutRecord {
  _id: string;
  token: string;
  userId: string;
  userNickname?: string;
  packId: string;
  productName: string;
  amountMinor: number;
  currency: "INR";
  status: CheckoutStatus;
  providerOrderId?: string;
  providerPaymentId?: string;
  paidAt?: string;
  grantedAt?: string;
  createdAt: string;
}

/** STR/09 `catalog_items` (+ art fields after an admin upload). */
export interface AdminCatalogItem {
  _id: string;
  category: string;
  name: string;
  price: number;
  tier: "common" | "fine" | "rare" | "cursed";
  free?: boolean;
  active: boolean;
  levelReq?: number;
  artSlug?: string;
  imageId?: string;
  imageUrl?: string;
  sort: number;
}

/** STR/09 `coin_packs` — the ONLY pricing authority for checkout (STR/08 §14). */
export interface CoinPackRecord {
  _id: string; // 'starter' | 'popular' | 'big-bag' | 'whale'
  name: string;
  priceMajor: number; // INR major units — never pre-multiplied to paise
  coins: number;
  bonus: number;
  active: boolean;
  sortOrder: number;
}

/** STR/09 `admin_audit` — every admin mutation lands here. */
export interface AdminAuditEntry {
  _id: string;
  actor: string;
  action: string;
  targetType: string;
  targetId: string;
  details?: string;
  at: string;
}

/** GET /api/admin/users/:id — user + joined ledger/payments for the drawer. */
export interface AdminUserDetail {
  user: AdminUser;
  ledger: WalletLedgerEntry[]; // newest first, last 50
  payments: CheckoutRecord[];
  matchCount: number;
}

/** GET /api/catalog — public item prices + active packs for the shop grid. */
export interface CatalogPage {
  items: PublicCatalogItem[];
  packs: CoinPackRecord[];
}

export interface PublicCatalogItem {
  _id: string;
  category: string;
  name: string;
  price: number;
  free?: boolean;
  active: boolean;
  levelReq?: number;
  sort?: number;
}

export type CatalogPatch = Partial<Pick<AdminCatalogItem, "name" | "price" | "active" | "imageId" | "imageUrl">>;
export type PackPatch = Partial<Pick<CoinPackRecord, "name" | "priceMajor" | "coins" | "bonus" | "active">>;

/** POST /api/billing/checkout — a null checkoutUrl means "not live yet". */
export interface CheckoutStartResult {
  checkoutUrl: string | null;
  provider?: "mock" | "proxy";
  token?: string;
}

/**
 * POST /api/billing/verify — the ONLY source of truth (the ?payment=paid
 * query on the return page is a hint, never trusted). Grants happen
 * server-side; `granted` tells whether THIS call credited (idempotent).
 */
export type BillingVerifyResult =
  | { status: "paid"; granted: boolean; coinsGranted: number; coinBalance: number; packName: string | null; amountMinor: number }
  | { status: "created"; packName: string | null }
  | { status: "failed"; packName: string | null }
  | { status: "expired" };

export type UploadResult = { imageId: string; imageUrl: string };

// ── leaderboard + profile (E1 economy REST — STR/07 §0 "Game/store") ────────

/** GET /api/leaderboard metrics (STR/09 derived reads; cached 60s server-side). */
export type LeaderboardMetric = "wins" | "kills" | "xp" | "titles";

export const LEADERBOARD_PER_PAGE_DEFAULT = 20;
export const LEADERBOARD_PER_PAGE_MAX = 50;

/**
 * One GET /api/leaderboard row — explicit public projection: rank is the
 * position for the requested metric; banned/deleted accounts never appear.
 * (Server-identical twin of the shared LeaderboardRowSchema — TODO-sync-with-shared.)
 */
export interface LeaderboardEntry {
  accountId: string;
  nickname: string;
  avatarSpec?: AdminAvatarSpec | null;
  activeTitle: string | null;
  level: number;
  rank: number;
  value: number;
}

export interface LeaderboardPage {
  metric: LeaderboardMetric;
  page: number;
  perPage: number;
  total: number;
  leaderboard: LeaderboardEntry[];
}

/** /api/me levelProgress — `xpToNextLevel`/`xpForLevel` are null at level 100. */
export interface ProfileLevelProgress {
  level: number;
  xp: number;
  xpIntoLevel: number;
  xpToNextLevel: number | null;
  xpForLevel: number | null;
  percent: number;
  atMax: boolean;
}

/** One match_records line — the requesting player's OWN stats only (STR/09). */
export interface ProfileMatchStats {
  kills: number;
  catches: number;
  falseAccusations: number;
  bluffSuccesses: number;
  deaths: number;
  pullsSurvived: number;
  roundsPlayed: number;
  won: boolean;
  xpEarned: number;
  coinsEarned: number;
}

export interface ProfileMatchRecord {
  matchId: string;
  roomCode: string;
  endedAt: string;
  capacity: number;
  theme: string;
  summary: { rounds: number; totalPulls: number; dareDevilMoments: number };
  you: {
    seat: number;
    nickname: string;
    titleAtPlay: string | null;
    stats: ProfileMatchStats;
  };
}

/** /api/me user — own account only; no email/provider identity rides along. */
export interface ProfileUser {
  id: string;
  nickname: string;
  name: string;
  avatarUrl: string | null;
  avatarSpec: AdminAvatarSpec | null;
  activeTitle: string | null;
  role: "user" | "admin";
  xp: number;
  level: number;
  createdAt: string;
  lastSeenAt: string;
}

export interface ProfileResponse {
  user: ProfileUser;
  /** Canonical level — recomputed from xp server-side, never the stored column. */
  level: number;
  levelProgress: ProfileLevelProgress;
  /** Equipped title (idle); the count of unlocked ones rides separately. */
  title: string | null;
  coins: number;
  unlockedTitleCount: number;
  /** Last 10 finished matches, newest first — the player's own line only. */
  recentMatchRecords: ProfileMatchRecord[];
}


// ══════════════════════════ mode + error plumbing ═══════════════════════════

export type ApiMode = "live" | "mock";

/** Mock in dev, live in production — env-tunable, per-tab overridable. */
export function getApiMode(): ApiMode {
  if (typeof window !== "undefined") {
    const raw = new URLSearchParams(window.location.search).get("apimode");
    if (raw === "live" || raw === "mock") return raw;
  }
  const env = process.env.NEXT_PUBLIC_API_MODE;
  if (env === "live" || env === "mock") return env;
  return process.env.NODE_ENV === "production" ? "live" : "mock";
}

/** Errors carried per the shared ack envelope: {ok:false, error:{code,message}}. */
export class ApiError extends Error {
  /** stable code ("AUTH_REQUIRED", "RATE_LIMITED", …) */
  readonly error: string;
  readonly status: number;

  constructor(error: string, message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.error = error;
    this.status = status;
  }
}

export function isApiError(err: unknown): err is ApiError {
  return err instanceof ApiError;
}

export function apiErrorMessage(err: unknown, fallback: string): string {
  if (isApiError(err)) return err.message;
  if (err instanceof Error && err.message) return err.message;
  return fallback;
}

type Unknown = Record<string, unknown>;

function asRecord(value: unknown): Unknown | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Unknown) : null;
}

/** Accepts {ok:false,error:{code,message}}, {error:{…}}, {error:"CODE",message} and {code,message}. */
function readError(body: unknown, status: number): { code: string; message: string } {
  const root = asRecord(body);
  const errObj = root ? asRecord(root["error"]) : null;
  const code =
    (typeof root?.["error"] === "string" ? (root["error"] as string) : undefined) ??
    (typeof errObj?.["code"] === "string" ? errObj["code"] : undefined) ??
    (typeof root?.["code"] === "string" ? root["code"] : undefined) ??
    "INTERNAL";
  const message =
    (typeof errObj?.["message"] === "string" ? errObj["message"] : undefined) ??
    (typeof root?.["message"] === "string" ? root["message"] : undefined) ??
    "Something went wrong.";
  return { code, message: `(${status}) ${message}` };
}

function unwrapData(body: unknown): unknown {
  const root = asRecord(body);
  if (root && root["ok"] === false) {
    const errObj = asRecord(root["error"]);
    const code = typeof errObj?.["code"] === "string" ? errObj["code"] : "INTERNAL";
    const message = typeof errObj?.["message"] === "string" ? errObj["message"] : "Request rejected.";
    throw new ApiError(code, `(${200}) ${message}`, 200);
  }
  if (root && "data" in root && root["ok"] === true) return root["data"];
  return body;
}

async function parseBody(res: Response): Promise<unknown> {
  const text = await res.text().catch(() => "");
  if (!text) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

/** Live-mode core: JSON in/out, cookies attached, normalized failures. */
async function apiFetch<T>(path: string, init: { method?: string; json?: unknown; headers?: Record<string, string>; signal?: AbortSignal } = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, {
      method: init.method ?? "GET",
      credentials: "include",
      headers: {
        ...(init.json !== undefined ? { "Content-Type": "application/json" } : {}),
        ...(init.headers ?? {}),
      },
      body: init.json !== undefined ? JSON.stringify(init.json) : undefined,
      signal: init.signal,
    });
  } catch {
    throw new ApiError("NETWORK", "Can't reach the saloon's back office right now.", 0);
  }

  const body = await parseBody(res);
  let payload: unknown;
  if (!res.ok) {
    const { code, message } = readError(body, res.status);
    throw new ApiError(res.status === 401 ? "AUTH_REQUIRED" : code, message, res.status);
  }
  payload = unwrapData(body);
  return (payload ?? null) as T;
}

function qs(params: Record<string, string | number | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") search.set(key, String(value));
  }
  const str = search.toString();
  return str ? `?${str}` : "";
}

// ═══════════════════════════════ auth ═══════════════════════════════════════

/** GET /api/auth/me — null when there is no session. */
export async function getMe(): Promise<AuthMe | null> {
  if (getApiMode() === "mock") return mockAuth.me();
  try {
    return await apiFetch<AuthMe | null>("/api/auth/me");
  } catch (err) {
    if (isApiError(err) && (err.status === 401 || err.error === "AUTH_REQUIRED" || err.status === 403)) return null;
    throw err;
  }
}

/** POST /api/auth/logout — server clears the session cookie. */
export async function postLogout(): Promise<void> {
  if (getApiMode() === "mock") {
    await mockAuth.logout();
    return;
  }
  await apiFetch<void>("/api/auth/logout", { method: "POST" }).catch(() => undefined);
}

/**
 * Probe of GET /api/auth/discord used only to render the "login unavailable"
 * state up front. The buttons themselves stay plain anchors — the backend
 * redirects onward; the client never runs an OAuth flow.
 */
export async function probeAuthProvider(): Promise<{ available: boolean; reason: "mock" | "not_configured" | "offline" | "ready" }> {
  if (getApiMode() === "mock") return { available: false, reason: "mock" };
  try {
    const res = await fetch("/api/auth/discord", { credentials: "include", redirect: "manual" });
    if (res.status === 503) return { available: false, reason: "not_configured" };
    // A configured provider answers with a redirect (opaque under `manual`).
    if (res.type === "opaqueredirect" || res.status === 302 || res.status === 307) {
      return { available: true, reason: "ready" };
    }
    // Anything else (404/500 from a missing or dead backend) → clearly "down".
    return { available: false, reason: "offline" };
  } catch {
    return { available: false, reason: "offline" };
  }
}

// ═══════════════════════════════ admin ══════════════════════════════════════

/** POST /api/admin/login {username, password} — server sets the lg_admin cookie. */
export async function adminLogin(username: string, password: string): Promise<void> {
  if (getApiMode() === "mock") {
    await mockAdmin.login(username, password); // demo: any credentials (real ones live in env)
    return;
  }
  await apiFetch<void>("/api/admin/login", { method: "POST", json: { username, password } });
}

/** GET /api/admin/audit (probe) — 401 → not signed in. Also feeds the AUDIT tab. */
export async function adminListAudit(page = 1, pageSize = 20): Promise<{ entries: AdminAuditEntry[]; page: number; pageSize: number; total: number }> {
  if (getApiMode() === "mock") return mockAdmin.listAudit(page, pageSize);
  return apiFetch(`/api/admin/audit${qs({ page, pageSize })}`);
}

/** POST /api/admin/logout — best-effort exit; the 8h cookie drops server-side. */
export async function adminLogout(): Promise<void> {
  if (getApiMode() === "mock") {
    await mockAdmin.logout();
    return;
  }
  await apiFetch<void>("/api/admin/logout", { method: "POST" }).catch(() => undefined);
}

/** GET /api/admin/users?search=&page=&pageSize= */
export async function adminListUsers(search: string, page: number, pageSize: number): Promise<AdminUsersPage> {
  if (getApiMode() === "mock") return mockAdmin.listUsers(search, page, pageSize);
  return apiFetch(`/api/admin/users${qs({ search, page, pageSize })}`);
}

/** GET /api/admin/users/:id — composed detail for the drawer. */
export async function getAdminUserDetail(id: string): Promise<AdminUserDetail> {
  if (getApiMode() === "mock") {
    const [user, ledger, payments] = await Promise.all([
      mockAdmin.getUser(id),
      mockAdmin.ledgerFor(id),
      mockAdmin.paymentsFor(id),
    ]);
    const ordered = ledger.slice().sort((a, b) => Date.parse(b.at) - Date.parse(a.at)).slice(0, 50);
    return { user, ledger: ordered, payments, matchCount: user.matchCount };
  }
  const body = await apiFetch<unknown>(`/api/admin/users/${encodeURIComponent(id)}`);
  const root = asRecord(body);
  const inner = root && "user" in root ? asRecord(root["user"]) : null;
  if (inner) {
    const user = inner as unknown as AdminUser;
    const ledger = Array.isArray(root?.["ledger"]) ? (root["ledger"] as WalletLedgerEntry[]) : [];
    const payments = Array.isArray(root?.["payments"]) ? (root["payments"] as CheckoutRecord[]) : [];
    const matchCount = typeof root?.["matchCount"] === "number" ? (root["matchCount"] as number) : user.matchCount;
    return { user, ledger, payments, matchCount };
  }
  const user = body as AdminUser;
  return { user, ledger: [], payments: [], matchCount: user.matchCount ?? 0 };
}

/** POST /api/admin/users/:id/coins {delta, reason} */
export async function adminAdjustCoins(id: string, delta: number, reason: string): Promise<AdminUser> {
  if (getApiMode() === "mock") return mockAdmin.adjustCoins(id, delta, reason);
  const user = await apiFetch<AdminUser>(`/api/admin/users/${encodeURIComponent(id)}/coins`, { method: "POST", json: { delta, reason } });
  return user;
}

/** POST /api/admin/users/:id/ban {banned?, reason} — banned defaults true. */
export async function adminSetBan(id: string, banned: boolean, reason: string): Promise<AdminUser> {
  if (getApiMode() === "mock") return mockAdmin.setBan(id, banned, reason);
  return apiFetch<AdminUser>(`/api/admin/users/${encodeURIComponent(id)}/ban`, { method: "POST", json: { banned, reason } });
}

/** GET /api/admin/payments?status=&page=&pageSize= */
export async function adminListPayments(status: CheckoutStatus | "all", page: number, pageSize: number): Promise<{ checkouts: CheckoutRecord[]; page: number; pageSize: number; total: number }> {
  if (getApiMode() === "mock") return mockAdmin.listPayments(status, page, pageSize);
  return apiFetch(`/api/admin/payments${qs({ status: status === "all" ? undefined : status, page, pageSize })}`);
}

/** GET /api/admin/catalog */
export async function adminListCatalog(): Promise<AdminCatalogItem[]> {
  if (getApiMode() === "mock") return mockAdmin.listCatalog();
  return apiFetch<AdminCatalogItem[]>("/api/admin/catalog");
}

/** POST /api/admin/catalog {category, name, price} */
export async function adminAddCatalogItem(input: { category: string; name: string; price: number }): Promise<AdminCatalogItem> {
  if (getApiMode() === "mock") return mockAdmin.addCatalogItem(input);
  return apiFetch<AdminCatalogItem>("/api/admin/catalog", { method: "POST", json: input });
}

/** PATCH /api/admin/catalog/:id — the owner's core request: name/price/active/order and image references. */
export async function adminPatchCatalogItem(id: string, patch: CatalogPatch): Promise<AdminCatalogItem> {
  if (getApiMode() === "mock") return mockAdmin.patchCatalogItem(id, patch);
  return apiFetch<AdminCatalogItem>(`/api/admin/catalog/${encodeURIComponent(id)}`, { method: "PATCH", json: patch });
}

/** PATCH /api/admin/packs/:key — coin-pack price editing (checkout prices from here). */
export async function adminPatchPack(key: string, patch: PackPatch): Promise<CoinPackRecord> {
  if (getApiMode() === "mock") return mockAdmin.patchPack(key, patch);
  return apiFetch<CoinPackRecord>(`/api/admin/packs/${encodeURIComponent(key)}`, { method: "PATCH", json: patch });
}

/** GET /api/admin/packs — the pack rows for the PACKS tab. */
export async function adminListPacks(): Promise<CoinPackRecord[]> {
  if (getApiMode() === "mock") return mockAdmin.listPacks();
  return apiFetch<CoinPackRecord[]>("/api/admin/packs");
}

/**
 * POST /api/admin/upload — raw multipart-free body: the File IS the body with
 * its own content-type (≤10MB, jpeg/png/webp/gif/avif/svg). Server-side relay
 * to the image server; returns {imageId, imageUrl} to PATCH onto the item.
 */
export function adminUploadArt(file: File, folder: string, onProgress: (pct: number) => void): Promise<UploadResult> {
  if (getApiMode() === "mock") return mockUpload(file, onProgress);
  const invalid = validateUpload(file);
  if (invalid) return Promise.reject(new ApiError("VALIDATION", invalid, 400));
  return new Promise<UploadResult>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `/api/admin/upload${qs({ folder })}`);
    xhr.withCredentials = true;
    xhr.setRequestHeader("Content-Type", file.type);
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(Math.min(100, Math.round((event.loaded / event.total) * 100)));
    };
    xhr.onerror = () => reject(new ApiError("NETWORK", "Upload failed — the wire went dead mid-haul.", 0));
    xhr.onload = () => {
      let body: unknown = null;
      try {
        body = JSON.parse(xhr.responseText || "null") as unknown;
      } catch {
        body = null;
      }
      if (xhr.status >= 200 && xhr.status < 300) {
        const root = asRecord(unwrapData(body));
        const imageId = typeof root?.["imageId"] === "string" ? root["imageId"] : undefined;
        const imageUrl = typeof root?.["imageUrl"] === "string" ? root["imageUrl"] : undefined;
        if (imageId && imageUrl) resolve({ imageId, imageUrl });
        else reject(new ApiError("UPLOAD", "The upload finished but the receipt was unreadable.", xhr.status));
        return;
      }
      const { code, message } = readError(body, xhr.status);
      reject(new ApiError(xhr.status === 401 ? "AUTH_REQUIRED" : code, message, xhr.status));
    };
    xhr.send(file);
  });
}

// ═════════════════════════════ billing + store ═════════════════════════════

/** GET /api/catalog — items + active packs (shop grid pricing). */
export async function getCatalogPage(): Promise<CatalogPage> {
  if (getApiMode() === "mock") return mockCatalog.publicCatalog();
  const body = await apiFetch<unknown>("/api/catalog");
  const root = asRecord(body);
  const items = Array.isArray(root?.["items"]) ? (root["items"] as PublicCatalogItem[]) : [];
  const packs = Array.isArray(root?.["packs"]) ? (root["packs"] as CoinPackRecord[]) : [];
  return { items, packs };
}

/** POST /api/billing/checkout {packId} → {checkoutUrl} — null until the proxy is activated. */
export async function checkoutPack(packId: string): Promise<CheckoutStartResult> {
  if (getApiMode() === "mock") return mockBilling.checkout(packId);
  try {
    const result = await apiFetch<CheckoutStartResult>("/api/billing/checkout", { method: "POST", json: { packId } });
    return { checkoutUrl: result?.checkoutUrl ?? null, provider: result?.provider, token: result?.token };
  } catch (err) {
    // provider not activated / any gateway refusal → the friendly modal, never a dead end
    if (isApiError(err) && (err.status === 501 || err.status === 503 || err.error.includes("CONFIG"))) {
      return { checkoutUrl: null, provider: "mock" };
    }
    throw err;
  }
}

/** POST /api/billing/verify {token} — grants happen here, idempotently, server-side. */
export async function verifyCheckout(token: string): Promise<BillingVerifyResult> {
  if (getApiMode() === "mock") return mockBilling.verify(token);
  return apiFetch<BillingVerifyResult>("/api/billing/verify", { method: "POST", json: { token } });
}

// ═════════════════ leaderboard + profile (E1 economy REST) ═══════════════════

/**
 * GET /api/leaderboard?metric=&page=&perPage= — public. `metric` defaults to
 * "xp" server-side; `perPage` clamps to 1–50 (default 20). 60s public cache is
 * a server header — this client just fetches per page/metric change.
 */
export async function getLeaderboard(
  params: { metric?: LeaderboardMetric; page?: number; perPage?: number } = {},
): Promise<LeaderboardPage> {
  const metric = params.metric ?? "xp";
  const page = Math.max(1, params.page ?? 1);
  const perPage = Math.min(LEADERBOARD_PER_PAGE_MAX, Math.max(1, params.perPage ?? LEADERBOARD_PER_PAGE_DEFAULT));
  if (getApiMode() === "mock") return mockLeaderboard.page(metric, page, perPage);
  return apiFetch<LeaderboardPage>(`/api/leaderboard${qs({ metric, page, perPage })}`);
}

/**
 * GET /api/me — the signed-in viewer's full profile (requireAuth). Identical
 * twin exists at /api/me/profile; this client consumes /api/me.
 * Errors: 401 AUTH_REQUIRED (session gone — surface as logged-out), 403 BANNED,
 * 404 USER_NOT_FOUND — thrown as ApiError for the caller to branch on.
 */
export async function getProfile(): Promise<ProfileResponse> {
  if (getApiMode() === "mock") return mockProfile.get();
  return apiFetch<ProfileResponse>("/api/me");
}
