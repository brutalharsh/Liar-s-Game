/**
 * ============================================================================
 * ADMIN / AUTH / BILLING MOCK DB — TODO-sync-with-shared
 * ============================================================================
 * In-memory stand-in for the S-A1 REST surface (STR/07 §0) so every auth /
 * admin / billing screen is fully clickable before the server lands.
 *
 * Shapes mirror STR/09 collections 1:1 (users, wallet_ledger, catalog_items,
 * coin_packs, checkouts, admin_audit). Only active while the api client is in
 * mock mode (`NEXT_PUBLIC_API_MODE=mock` or `?apimode=mock`); the live branch
 * in `src/lib/api.ts` never touches this module.
 *
 * Nothing real in here: no service names, no URLs, no credentials. Values the
 * real system configures at runtime (admin login, provider keys) are dummies.
 * ============================================================================
 */

import type {
  AdminAuditEntry,
  AdminCatalogItem,
  AdminUser,
  AdminUsersPage,
  AuthMe,
  BillingVerifyResult,
  CatalogPage,
  CheckoutRecord,
  CheckoutStatus,
  CoinPackRecord,
  WalletLedgerEntry,
} from "@/lib/api";
import { SHOP_ITEMS, COIN_PACKS } from "./catalog";
import { mockFetch } from "./api";
import { seededRng, randInt } from "./rng";
import type { AvatarAnimal } from "@/lib/wire";

// ── tiny helpers ───────────────────────────────────────────────────────────

const HOUR = 3_600_000;

/** Deterministic "recent" timestamps (fixtures rendered SSR + client identically). */
function ts(hoursAgo: number): string {
  return new Date(Date.parse("2026-11-23T21:00:00Z") - hoursAgo * HOUR).toISOString();
}

let idCounter = 0;
function nextId(prefix: string): string {
  idCounter += 1;
  return `${prefix}-${idCounter.toString(36)}`;
}

// ── users (STR/09 `users`) ─────────────────────────────────────────────────

const CAST: readonly {
  id: string;
  nick: string;
  animal: AvatarAnimal;
  provider: "discord" | "google";
  banned?: string;
  spec?: Partial<AdminUser["avatarSpec"]>;
}[] = [
  { id: "u-me", nick: "MAVERICK", animal: "fox", provider: "google", spec: { hat: "hat-stetson", shirt: "shirt-vest" } },
  { id: "u-scubb", nick: "SCUBB", animal: "raccoon", provider: "discord", spec: { hat: "hat-bowler", glasses: "glasses-shades" } },
  { id: "u-sue", nick: "SUE", animal: "owl", provider: "discord", spec: { glasses: "glasses-monocle", shirt: "shirt-stringtie" } },
  { id: "u-toar", nick: "TOAR", animal: "wolf", provider: "google", spec: { beard: "beard-dock", shirt: "shirt-denim" } },
  { id: "u-fox", nick: "FOX", animal: "fox", provider: "discord", spec: { hat: "hat-feather", hair: "hair-ginger" } },
  { id: "u-bris", nick: "BRIS", animal: "bear", provider: "google", spec: { beard: "beard-longgrey", frame: "frame-brass" } },
  { id: "u-migo", nick: "MIGO", animal: "deer", provider: "discord", spec: { hair: "hair-brunette", shirt: "shirt-cardsharp" } },
  { id: "u-lblanc", nick: "LBLANC", animal: "gator", provider: "discord", spec: { hat: "hat-professor", glasses: "glasses-goggles" } },
  { id: "u-rex", nick: "REX", animal: "boar", provider: "google", spec: { beard: "beard-stubble", hair: "hair-mullet" } },
  { id: "u-mia", nick: "MIA", animal: "cat", provider: "google", spec: { glasses: "glasses-shades", hair: "hair-silver" } },
  { id: "u-otto", nick: "OTTO", animal: "rabbit", provider: "discord", spec: { hat: "hat-newsboy" } },
  { id: "u-viper", nick: "VIPER", animal: "snake", provider: "discord", spec: { frame: "frame-vortex", voicePack: "voice-whisper" } },
  { id: "u-haley", nick: "HALEY", animal: "eagle", provider: "google", spec: { hair: "hair-bleach", anim: "anim-sway" } },
  { id: "u-juno", nick: "JUNO", animal: "cat", provider: "discord", spec: { hat: "hat-feather", shirt: "shirt-rouge" } },
  { id: "u-pierre", nick: "PIERRE", animal: "boar", provider: "google", spec: { beard: "beard-incognito" } },
  { id: "u-ada", nick: "ADA", animal: "owl", provider: "discord", spec: { glasses: "glasses-monocle", frame: "frame-ivory" } },
  { id: "u-boone", nick: "BOONE", animal: "bear", provider: "google" },
  { id: "u-raz", nick: "RAZ", animal: "fox", provider: "discord", spec: { hair: "hair-pompadour", voicePack: "voice-bard" } },
  { id: "u-nia", nick: "NIA", animal: "deer", provider: "google", spec: { shirt: "shirt-hi-vis" } },
  { id: "u-gus", nick: "GUS", animal: "wolf", provider: "discord", spec: { hat: "hat-stetson", beard: "beard-dock" } },
  { id: "u-koi", nick: "KOI", animal: "gator", provider: "discord", banned: "Repeat table-tampering — caught reading the shoe.", spec: { frame: "frame-mahogany", anim: "anim-draw" } },
];

const TITLES_POOL: readonly string[] = [
  "Best Liar", "Sharp Eye", "Regular", "Dead Eye", "Smooth Talker", "Bar Legend", "Honest Fool",
];

function buildUser(entry: (typeof CAST)[number], index: number): AdminUser {
  const rng = seededRng("user:" + entry.id);
  const level = randInt(rng, 2, 38);
  const xp = randInt(rng, level * 120, level * 900);
  return {
    _id: entry.id,
    provider: entry.provider,
    providerId: `demo-${entry.id}`,
    email: `${entry.nick.toLowerCase()}@example.com`,
    name: entry.nick[0]! + entry.nick.slice(1).toLowerCase() + " Doe",
    nickname: entry.nick,
    role: "user",
    banned: !!entry.banned,
    banReason: entry.banned,
    avatarSpec: { base: entry.animal, ...(entry.spec ?? {}) },
    activeTitle: rng() < 0.7 ? TITLES_POOL[Math.floor(rng() * TITLES_POOL.length)] ?? "Regular" : undefined,
    xp,
    nextLevelXp: Math.round(xp * 1.35) + 50, // display-only estimate — real curve is server-side (STR/04 §5) // TODO-sync-with-shared
    level,
    createdAt: ts(randInt(rng, 500, 4200)),
    lastSeenAt: ts(randInt(rng, 1, index + 15)),
    coinBalance: 0, // derived below from the ledger
    matchCount: randInt(rng, level * 2, level * 9),
  };
}

// ── wallet ledger (STR/09 `wallet_ledger`) ─────────────────────────────────

function buildLedger(user: AdminUser): WalletLedgerEntry[] {
  const rng = seededRng("ledger:" + user._id);
  const entries: WalletLedgerEntry[] = [];
  let clock = randInt(rng, 20, 120);
  const push = (delta: number, reason: WalletLedgerEntry["reason"], refId: string) => {
    entries.push({
      _id: nextId("led"),
      accountId: user._id,
      delta,
      reason,
      refId,
      txId: `${reason}:${refId}`,
      at: ts(clock),
    });
    clock += randInt(rng, 2, 26);
  };
  const matches = Math.max(3, Math.round(user.matchCount / 4));
  for (let m = 0; m < matches; m++) {
    const matchId = `m-${user._id.slice(2)}-${m}`;
    if (rng() < 0.35) push(randInt(rng, 2, 7), "win", matchId);
    push(1, "survived_round", `${matchId}:r${randInt(rng, 1, 6)}`);
    if (rng() < 0.4) {
      const item = SHOP_ITEMS[Math.floor(rng() * SHOP_ITEMS.length)];
      push(-(item?.price ?? 100), "spend", item?.id ?? "hat-bowler");
    }
    if (rng() < 0.2) push(randInt(rng, 100, 1200), "purchase", ["starter", "popular", "big-bag", "whale"][Math.floor(rng() * 4)]!);
  }
  if (rng() < 0.15) push(randInt(rng, -300, 300), "adjust", "support-" + nextId("s"));
  return entries;
}

// ── seed the in-memory DB ───────────────────────────────────────────────────

const USERS: AdminUser[] = CAST.map(buildUser);
const LEDGER: WalletLedgerEntry[] = [];
for (const user of USERS) {
  const rows = buildLedger(user);
  LEDGER.push(...rows);
  user.coinBalance = rows.reduce((sum, r) => sum + r.delta, 0);
}
// The viewer starts solvent for demos.
const VIEWER = USERS.find((u) => u._id === "u-me");
if (VIEWER && VIEWER.coinBalance < 400) VIEWER.coinBalance += 850;

// ── coin packs (STR/09 `coin_packs`; pricing authority — STR/04 §1) ────────

export const PACKS: CoinPackRecord[] = COIN_PACKS.map((p, i) => ({
  _id: p.id.replace(/^pack-/, ""), // pack-starter → starter (STR/09 key)
  name: p.name,
  priceMajor: p.priceInr,
  coins: p.coins,
  bonus: p.bonus,
  active: true,
  sortOrder: i,
}));

// ── catalog_items (STR/09 `catalog_items`, seeded from W1's shop) ───────────

const CATALOG: AdminCatalogItem[] = SHOP_ITEMS.map((item, i) => ({
  _id: item.id,
  category: item.category,
  name: item.name,
  price: item.price,
  tier: item.price === 0 ? "common" : item.price > 300 ? "epic" : "rare",
  free: item.price === 0 && !item.levelReq,
  active: true,
  levelReq: item.levelReq,
  artSlug: item.id,
  sort: i,
}));

// ── checkouts (STR/09 `checkouts`) ──────────────────────────────────────────

const CHECKOUTS: CheckoutRecord[] = [
  { _id: nextId("ck"), token: "ck_demo_paid_sue_01", userId: "u-sue", packId: "popular", productName: "Popular pack", amountMinor: 9900, currency: "INR", status: "paid", providerOrderId: "order_demo01", providerPaymentId: "pay_demo01", paidAt: ts(50), grantedAt: ts(50), createdAt: ts(51) },
  { _id: nextId("ck"), token: "ck_demo_paid_fox_02", userId: "u-fox", packId: "starter", productName: "Starter pack", amountMinor: 4900, currency: "INR", status: "paid", providerOrderId: "order_demo02", providerPaymentId: "pay_demo02", paidAt: ts(70), grantedAt: ts(70), createdAt: ts(71) },
  { _id: nextId("ck"), token: "ck_demo_paid_bris_03", userId: "u-bris", packId: "whale", productName: "Whale pack", amountMinor: 39900, currency: "INR", status: "paid", providerOrderId: "order_demo03", providerPaymentId: "pay_demo03", paidAt: ts(90), grantedAt: ts(89), createdAt: ts(95) },
  { _id: nextId("ck"), token: "ck_demo_paid_me_04", userId: "u-me", packId: "big-bag", productName: "Big Bag pack", amountMinor: 19900, currency: "INR", status: "paid", providerOrderId: "order_demo04", providerPaymentId: "pay_demo04", paidAt: ts(24), grantedAt: ts(24), createdAt: ts(26) },
  { _id: nextId("ck"), token: "ck_demo_paid_migo_05", userId: "u-migo", packId: "popular", productName: "Popular pack", amountMinor: 9900, currency: "INR", status: "paid", providerOrderId: "order_demo05", providerPaymentId: "pay_demo05", paidAt: ts(110), grantedAt: ts(110), createdAt: ts(111) },
  { _id: nextId("ck"), token: "ck_demo_open_rex_06", userId: "u-rex", packId: "starter", productName: "Starter pack", amountMinor: 4900, currency: "INR", status: "created", providerOrderId: "order_demo06", createdAt: ts(0.3) },
  { _id: nextId("ck"), token: "ck_demo_open_mia_07", userId: "u-mia", packId: "big-bag", productName: "Big Bag pack", amountMinor: 19900, currency: "INR", status: "created", providerOrderId: "order_demo07", createdAt: ts(0.1) },
  { _id: nextId("ck"), token: "ck_demo_fail_toar_08", userId: "u-toar", packId: "popular", productName: "Popular pack", amountMinor: 9900, currency: "INR", status: "failed", providerOrderId: "order_demo08", createdAt: ts(8) },
  { _id: nextId("ck"), token: "ck_demo_fail_ada_09", userId: "u-ada", packId: "starter", productName: "Starter pack", amountMinor: 4900, currency: "INR", status: "failed", providerOrderId: "order_demo09", createdAt: ts(16) },
  { _id: nextId("ck"), token: "ck_demo_expr_otto_10", userId: "u-otto", packId: "whale", productName: "Whale pack", amountMinor: 39900, currency: "INR", status: "expired", providerOrderId: "order_demo10", createdAt: ts(200) },
  { _id: nextId("ck"), token: "ck_demo_expr_nia_11", userId: "u-nia", packId: "big-bag", productName: "Big Bag pack", amountMinor: 19900, currency: "INR", status: "expired", providerOrderId: "order_demo11", createdAt: ts(180) },
];

function nickOf(userId: string): string {
  return USERS.find((u) => u._id === userId)?.nickname ?? "—";
}

// ── admin_audit (STR/09 `admin_audit`) ─────────────────────────────────────

const AUDIT: AdminAuditEntry[] = [
  { _id: nextId("aud"), actor: "admin", action: "coins.adjust", targetType: "user", targetId: "u-sue", details: "+120 — tournament prize make-good", at: ts(30) },
  { _id: nextId("aud"), actor: "admin", action: "user.ban", targetType: "user", targetId: "u-koi", details: "Repeat table-tampering — caught reading the shoe.", at: ts(45) },
  { _id: nextId("aud"), actor: "admin", action: "catalog.patch", targetType: "catalog_item", targetId: "theme-neon", details: "price 550 → 500", at: ts(64) },
  { _id: nextId("aud"), actor: "admin", action: "catalog.create", targetType: "catalog_item", targetId: "voice-bard", details: "The Bard — 500 coins", at: ts(66) },
  { _id: nextId("aud"), actor: "admin", action: "pack.patch", targetType: "coin_pack", targetId: "popular", details: "priceMajor 99 (unchanged)", at: ts(78) },
  { _id: nextId("aud"), actor: "admin", action: "upload.image", targetType: "catalog_item", targetId: "hat-stetson", details: "art uploaded — image server (id only, url derived)", at: ts(88) },
];

function recordAudit(action: string, targetType: string, targetId: string, details: string): void {
  AUDIT.push({
    _id: nextId("aud"),
    actor: "admin",
    action,
    targetType,
    targetId,
    details,
    at: new Date().toISOString(),
  });
}

// ── sessions (mock only; the real session is a server-set httpOnly cookie) ──

let viewerSessionId: string | null = "u-me"; // demo starts signed-in so everything is clickable
let adminSession = false;

export function signInDemoViewer(): void {
  viewerSessionId = "u-me";
}

export function hasDemoViewer(): boolean {
  return viewerSessionId !== null;
}

// ── mock endpoint handlers (mirror the S-A1 routes) ─────────────────────────
// No real credentials live anywhere below: the real admin login is configured
// at runtime via env (STR/02); mock mode accepts any non-empty pair.

export const mockAuth = {
  async me(): Promise<AuthMe | null> {
    return mockFetch<AuthMe | null>(
      viewerSessionId ? viewerFrom(USERS.find((u) => u._id === viewerSessionId) ?? null) : null,
      { emptyValue: null },
    );
  },
  async logout(): Promise<void> {
    await mockFetch(null);
    viewerSessionId = null;
  },
};

function viewerFrom(user: AdminUser | null): AuthMe | null {
  if (!user) return null;
  return {
    id: user._id,
    provider: user.provider,
    name: user.name,
    nickname: user.nickname,
    avatarSpec: user.avatarSpec,
    level: user.level,
    coinBalance: user.coinBalance,
  };
}

export const mockAdmin = {
  async login(username: string, password: string): Promise<void> {
    if (username.trim() === "" || password === "") {
      throw new Error("Bad demo credentials");
    }
    await mockFetch(null, { minDelayMs: 550 });
    adminSession = true;
    recordAudit("admin.login", "session", "admin", "dashboard session opened (mock)");
  },

  async logout(): Promise<void> {
    adminSession = false;
    recordAudit("admin.logout", "session", "admin", "dashboard session closed");
    await mockFetch(null);
  },

  async listUsers(search: string, page: number, pageSize: number): Promise<AdminUsersPage> {
    if (!adminSession) throw new Error("AUTH_REQUIRED");
    const q = search.trim().toLowerCase();
    const filtered = q
      ? USERS.filter((u) => u.nickname.toLowerCase().includes(q) || u.name.toLowerCase().includes(q) || (u.email ?? "").toLowerCase().includes(q))
      : USERS.slice();
    sortedBySeen(filtered);
    const start = (page - 1) * pageSize;
    return mockFetch<AdminUsersPage>(
      { users: filtered.slice(start, start + pageSize), page, pageSize, total: filtered.length },
    );
  },

  async getUser(id: string): Promise<AdminUser> {
    if (!adminSession) throw new Error("AUTH_REQUIRED");
    const user = USERS.find((u) => u._id === id);
    if (!user) throw new Error("User not found");
    return mockFetch<AdminUser>({ ...user });
  },

  async ledgerFor(accountId: string): Promise<WalletLedgerEntry[]> {
    return LEDGER.filter((l) => l.accountId === accountId);
  },

  async paymentsFor(userId: string): Promise<CheckoutRecord[]> {
    return CHECKOUTS.filter((c) => c.userId === userId);
  },

  async adjustCoins(id: string, delta: number, reason: string): Promise<AdminUser> {
    if (!adminSession) throw new Error("AUTH_REQUIRED");
    const user = USERS.find((u) => u._id === id);
    if (!user) throw new Error("User not found");
    const refId = nextId("adj");
    LEDGER.push({ _id: nextId("led"), accountId: id, delta, reason: "adjust", refId, txId: `adjust:${refId}`, at: new Date().toISOString() });
    user.coinBalance += delta;
    recordAudit("coins.adjust", "user", id, `${delta >= 0 ? "+" : ""}${delta} — ${reason}`);
    return mockFetch<AdminUser>({ ...user }, { minDelayMs: 300 });
  },

  async setBan(id: string, banned: boolean, reason: string): Promise<AdminUser> {
    if (!adminSession) throw new Error("AUTH_REQUIRED");
    const user = USERS.find((u) => u._id === id);
    if (!user) throw new Error("User not found");
    user.banned = banned;
    user.banReason = banned ? reason : undefined;
    recordAudit(banned ? "user.ban" : "user.unban", "user", id, reason);
    return mockFetch<AdminUser>({ ...user }, { minDelayMs: 300 });
  },

  async listPayments(status: CheckoutStatus | "all", page: number, pageSize: number): Promise<{ checkouts: CheckoutRecord[]; page: number; pageSize: number; total: number }> {
    if (!adminSession) throw new Error("AUTH_REQUIRED");
    const rows = (status === "all" ? CHECKOUTS.slice() : CHECKOUTS.filter((c) => c.status === status))
      .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
      .map((c) => ({ ...c, userNickname: nickOf(c.userId) }));
    const start = (page - 1) * pageSize;
    return mockFetch({ checkouts: rows.slice(start, start + pageSize), page, pageSize, total: rows.length });
  },

  async listCatalog(): Promise<AdminCatalogItem[]> {
    if (!adminSession) throw new Error("AUTH_REQUIRED");
    return mockFetch(CATALOG.slice().sort((a, b) => a.sort - b.sort));
  },

  async addCatalogItem(input: { category: string; name: string; price: number }): Promise<AdminCatalogItem> {
    if (!adminSession) throw new Error("AUTH_REQUIRED");
    const item: AdminCatalogItem = {
      _id: nextId("item"),
      category: input.category,
      name: input.name,
      price: input.price,
      tier: input.price === 0 ? "common" : "rare",
      free: input.price === 0,
      active: true,
      sort: CATALOG.length,
    };
    CATALOG.push(item);
    recordAudit("catalog.create", "catalog_item", item._id, `${item.name} — ${item.price} coins`);
    return mockFetch<AdminCatalogItem>({ ...item }, { minDelayMs: 300 });
  },

  async patchCatalogItem(id: string, patch: Partial<Pick<AdminCatalogItem, "name" | "price" | "active" | "imageId" | "imageUrl">>): Promise<AdminCatalogItem> {
    if (!adminSession) throw new Error("AUTH_REQUIRED");
    const item = CATALOG.find((c) => c._id === id);
    if (!item) throw new Error("Item not found");
    const before: string[] = [];
    if (patch.name !== undefined && patch.name !== item.name) before.push(`name ${item.name} → ${patch.name}`);
    if (patch.price !== undefined && patch.price !== item.price) before.push(`price ${item.price} → ${patch.price}`);
    if (patch.active !== undefined && patch.active !== item.active) before.push(`active ${item.active} → ${patch.active}`);
    Object.assign(item, patch);
    recordAudit("catalog.patch", "catalog_item", id, before.join(", ") || "image art updated");
    return mockFetch<AdminCatalogItem>({ ...item }, { minDelayMs: 250 });
  },

  async patchPack(key: string, patch: Partial<Pick<CoinPackRecord, "name" | "priceMajor" | "coins" | "bonus" | "active">>): Promise<CoinPackRecord> {
    if (!adminSession) throw new Error("AUTH_REQUIRED");
    const pack = PACKS.find((p) => p._id === key);
    if (!pack) throw new Error("Pack not found");
    const changes: string[] = [];
    for (const field of ["name", "priceMajor", "coins", "bonus", "active"] as const) {
      if (patch[field] !== undefined && patch[field] !== pack[field]) {
        changes.push(`${field} ${String(pack[field])} → ${String(patch[field])}`);
      }
    }
    Object.assign(pack, patch);
    recordAudit("pack.patch", "coin_pack", key, changes.join(", ") || "no-op");
    return mockFetch<CoinPackRecord>({ ...pack }, { minDelayMs: 300 });
  },

  async listPacks(): Promise<CoinPackRecord[]> {
    if (!adminSession) throw new Error("AUTH_REQUIRED");
    return mockFetch(PACKS.slice().sort((a, b) => a.sortOrder - b.sortOrder));
  },

  async listAudit(page: number, pageSize: number): Promise<{ entries: AdminAuditEntry[]; page: number; pageSize: number; total: number }> {
    if (!adminSession) throw new Error("AUTH_REQUIRED");
    const rows = AUDIT.slice().sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
    const start = (page - 1) * pageSize;
    return mockFetch({ entries: rows.slice(start, start + pageSize), page, pageSize, total: rows.length }, { minDelayMs: 260 });
  },
};

function sortedBySeen(rows: AdminUser[]): void {
  rows.sort((a, b) => Date.parse(b.lastSeenAt) - Date.parse(a.lastSeenAt));
}

// ── public store endpoints (GET /api/catalog) ───────────────────────────────

export const mockCatalog = {
  async publicCatalog(): Promise<CatalogPage> {
    const items = CATALOG.filter((c) => c.active).map((c) => ({
      _id: c._id,
      category: c.category,
      name: c.name,
      price: c.price,
      free: !!c.free,
      active: c.active,
      levelReq: c.levelReq,
      sort: c.sort,
    }));
    return mockFetch<CatalogPage>({ items, packs: PACKS.filter((p) => p.active).map((p) => ({ ...p })) }, { minDelayMs: 300 });
  },
};

// ── billing (POST /api/billing/*) ───────────────────────────────────────────

export const mockBilling = {
  /** Mock provider: never returns a checkoutUrl, never creates records, never credits. */
  async checkout(_packId: string): Promise<{ checkoutUrl: string | null; provider: "mock" | "proxy" }> {
    return mockFetch({ checkoutUrl: null, provider: "mock" as const }, { minDelayMs: 320 });
  },

  async verify(token: string): Promise<BillingVerifyResult> {
    const pack = PACKS[1] ?? PACKS[0]!;
    const balance = VIEWER?.coinBalance ?? 1250;
    let outcome: BillingVerifyResult = {
      status: "paid",
      granted: true,
      coinsGranted: pack.coins + pack.bonus,
      coinBalance: balance + pack.coins + pack.bonus,
      packName: pack.name,
      amountMinor: pack.priceMajor * 100,
    };
    if (token.includes("already")) {
      outcome = { status: "paid", granted: false, coinsGranted: 0, coinBalance: balance, packName: pack.name, amountMinor: pack.priceMajor * 100 };
    } else if (token.includes("process") || token.includes("created")) {
      outcome = { status: "created", packName: pack.name };
    } else if (token.includes("fail")) {
      outcome = { status: "failed", packName: pack.name };
    } else if (token.includes("expire")) {
      outcome = { status: "expired" };
    } else if (seededRng("billing:" + token)() < 0.14) {
      // deterministic per token: some ordinary tokens already had their coins
      outcome = { status: "paid", granted: false, coinsGranted: 0, coinBalance: balance, packName: pack.name, amountMinor: pack.priceMajor * 100 };
    }
    return mockFetch<BillingVerifyResult>(outcome, { minDelayMs: 500 });
  },
};

// ── uploads (POST /api/admin/upload → the image server, server-side only) ───

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
export const UPLOAD_TYPES: readonly string[] = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/avif", "image/svg+xml"];

export function validateUpload(file: File): string | null {
  if (!UPLOAD_TYPES.includes(file.type) && !(file.name.toLowerCase().endsWith(".svg") && file.type === "")) {
    return `Unsupported picture type ("${file.type || "unknown"}"). Allowed: JPEG, PNG, WebP, GIF, AVIF, SVG.`;
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return "That picture is over 10 MB — shrink it first.";
  }
  return null;
}

export async function mockUpload(
  file: File,
  onProgress: (pct: number) => void,
): Promise<{ imageId: string; imageUrl: string }> {
  const invalid = validateUpload(file);
  if (invalid) throw new Error(invalid);
  for (let pct = 0; pct <= 100; pct += randInt(seededRng("prog:" + file.name + file.size), 14, 24)) {
    onProgress(Math.min(pct, 100));
    await new Promise((res) => setTimeout(res, 110));
  }
  onProgress(100);
  return {
    imageId: nextId("img"),
    imageUrl: URL.createObjectURL(file), // local preview stand-in; real uploads return the hosted file url
  };
}
