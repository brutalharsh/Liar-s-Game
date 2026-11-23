"use client";

/**
 * ============================================================================
 * MOCK PERSONA — the signed-in viewer's self-service state (T4 settings)
 * ============================================================================
 * In-memory stand-in for the T3 /api/me mutation surface (frozen 2026-11-23):
 *
 *   POST /api/me/equip    { slot, itemId }   → { ok, spec }
 *   PUT  /api/me/profile  { nickname }       → { ok, nickname }
 *   GET  /api/me/entitlements                → { entitlements }
 *
 * Mirrors apps/server/src/routes/me.ts branch-for-branch: the 5 attachable
 * slots + 'base' (thin humans free, every other base gated by its body:*
 * catalog item), full-catalog-id lookups, category match (ITEM_SLOT_MISMATCH),
 * ownership via entitlement keys (EQUIPMENT_NOT_OWNED), null = unequip, and
 * the shared sanitizer as the nickname authority (422 NICKNAME_REJECTED).
 *
 * Catalog ids are the production seed shapes ('hat:cowboy', 'body:dog' —
 * lib/mock/catalog mirrors apps/server/scripts/seed-catalog.ts), so the
 * entitlement-key rule is the same in mock and live: the slug after the first
 * ':' (lib/api.ts `catalogItemKey`).
 *
 * State is deliberately IN-MEMORY (module scope, per tab session): the wire
 * session rides an httpOnly cookie server-side, and no localStorage tokens
 * are ever fabricated here. `resetViewerPersona()` exists for tests only.
 * ============================================================================
 */

import {
  ApiError,
  catalogItemKey,
  type AdminAvatarSpec,
  type EntitlementsResponse,
  type EquipAck,
  type ProfileAck,
  type UserEntitlement,
} from "@/lib/api";
import { AVATAR_BASE_IDS, DEFAULT_AVATAR_BASE, sanitizeNickname, type AvatarBaseId } from "@/lib/wire";
import { SHOP_ITEMS, type ShopItem } from "./catalog";
import { mockFetch } from "./api";

// ── base helpers (server FREE_BASES rule + the catalog's body rows) ────────

/** Bases every account may equip with no catalog item (server FREE_BASES). */
export const FREE_BASES: readonly string[] = AVATAR_BASE_IDS.filter(
  (id) => id.startsWith("human-") && id.endsWith("-thin"),
);

export function isFreeBase(base: string): boolean {
  return FREE_BASES.includes(base);
}

/** Catalog row for a non-free base — undefined for the two free thins. */
function bodyRow(base: string): ShopItem | undefined {
  return SHOP_ITEMS.find((item) => item.category === "body" && item.id === `body:${base}`);
}

const ATTACHABLE_SLOTS = ["hair", "beard", "hat", "shirt", "glasses"] as const;
type PersonaAttachable = (typeof ATTACHABLE_SLOTS)[number];
export type PersonaEquipSlot = PersonaAttachable | "base";

// ── persona session state (in-memory; never persisted) ──────────────────────

const INITIAL_SPEC: AdminAvatarSpec = {
  base: "human-female-thin",
  hair: "hair:braids",
  hat: "hat:cowboy",
  shirt: "shirt:red",
  glasses: "glasses:round",
  frame: "frame:brass",
};

const NICKNAME_START = "MAVERICK";

/**
 * What the demo viewer owns — WIRE-SHAPED entitlement keys (kind 'item', key =
 * the slug after the first ':' — mirroring the server's ownership join, so
 * 'hat:cowboy' the catalog id is key 'cowboy' on the wire). Deliberately a
 * broad-but-incomplete set so every settings state is demonstrable: equipped
 * pieces (all owned — coherence), spare owned pieces (swap freely), and juicy
 * unowned ones (pinstripe suit / sombrero / mohawk / monocle / gym + species
 * bodies / orbital + kabuki themes) that preview fine but fail to equip with
 * 403 EQUIPMENT_NOT_OWNED until claimed in the shop.
 */
const OWNED_ITEM_KEYS: readonly string[] = [
  // hair — hair:short · hair:braids · hair:man-bun
  "short",
  "braids",
  "man-bun",
  // beard — beard:clean-shaven (a wearable "empty") · beard:goatee
  "clean-shaven",
  "goatee",
  // hats — hat:cowboy · hat:cap
  "cowboy",
  "cap",
  // shirts — shirt:white · shirt:red · shirt:vest
  "white",
  "red",
  "vest",
  // glasses — glasses:round · glasses:aviators
  "round",
  "aviators",
  // frames (display-only this wave — the equip contract has no frame slot)
  "plain",
  "wooden",
  "brass",
  "prestige-bronze",
];
const OWNED_THEME_KEYS: readonly string[] = ["speakeasy", "haunted"];
const OWNED_TITLE_KEYS: readonly string[] = ["dead-eye", "sharp-eye", "regular", "smooth-talker", "best-liar"];

let viewerSpec: AdminAvatarSpec = { ...INITIAL_SPEC };
let viewerNickname: string = NICKNAME_START;

/** Owned item ids beyond the seed list (shop grants land server-side; the
 *  seam exists so later waves can credit the mock persona mid-session). */
const grantedItems = new Set<string>();

/** Tests only — restores the seed persona (spec + nickname + credits). */
export function resetViewerPersona(): void {
  viewerSpec = { ...INITIAL_SPEC };
  viewerNickname = NICKNAME_START;
  grantedItems.clear();
}

/** Current viewer nickname — consumed by the mock /api/me + /api/auth/me. */
export function viewerNicknameSnapshot(): string {
  return viewerNickname;
}

/** Current viewer avatarSpec (wire-shaped; never holds `undefined` keys). */
export function viewerSpecSnapshot(): AdminAvatarSpec {
  return { ...viewerSpec };
}

// ── entitlements (STR/09 entitlements rows — the settings inventory's spine) ──

function entitlementRows(): UserEntitlement[] {
  const rows: UserEntitlement[] = [];
  for (const key of OWNED_ITEM_KEYS) rows.push({ kind: "item", key, source: "seed", at: "2026-10-04T12:00:00.000Z" });
  for (const key of grantedItems) rows.push({ kind: "item", key, source: "shop", at: new Date().toISOString() });
  for (const key of OWNED_THEME_KEYS) rows.push({ kind: "theme", key, source: "purchase", at: "2026-10-19T18:00:00.000Z" });
  for (const key of OWNED_TITLE_KEYS) rows.push({ kind: "title", key, source: "earned", at: "2026-11-02T21:00:00.000Z" });
  return rows;
}

function ownsItemKey(key: string): boolean {
  return OWNED_ITEM_KEYS.includes(key) || grantedItems.has(key);
}

// ── pure equip core (mirrors server mergeAvatarSpec + its validation) ────────

export type EquipPlanResult =
  | { ok: true; spec: AdminAvatarSpec }
  | { ok: false; code: "BAD_REQUEST" | "INVALID_BASE" | "BASE_REQUIRED" | "ITEM_SLOT_MISMATCH" | "ITEM_NOT_FOUND" | "EQUIPMENT_NOT_OWNED" };

/** Flat one-slot merge — untouched keys ride through; `undefined` never lands. */
export function mergePersonaSpec(
  current: AdminAvatarSpec | null | undefined,
  slot: PersonaEquipSlot,
  itemId: string | null,
): AdminAvatarSpec {
  const next: AdminAvatarSpec = { ...(current ?? { base: DEFAULT_AVATAR_BASE }) };
  if (slot === "base") {
    if (itemId === null) return next; // guarded earlier — never reached
    next.base = itemId;
    return next;
  }
  if (itemId === null) {
    delete next[slot];
    return next;
  }
  next[slot] = itemId;
  return next;
}

/**
 * Pure equip decision — no state, no awaits; the async mock endpoint runs it
 * against the live persona. Mirrors apps/server/src/routes/me.ts.
 */
export function planEquip(
  slot: string,
  itemId: string | null,
  current: AdminAvatarSpec | null | undefined,
  isOwned: (key: string) => boolean,
): EquipPlanResult {
  if (slot === "base") {
    if (itemId === null) return { ok: false, code: "BASE_REQUIRED" };
    if (!(AVATAR_BASE_IDS as readonly string[]).includes(itemId)) {
      return { ok: false, code: "INVALID_BASE" };
    }
    if (!isFreeBase(itemId)) {
      const row = bodyRow(itemId);
      if (!row) return { ok: false, code: "ITEM_NOT_FOUND" };
      if (!isOwned(catalogItemKey(row.id))) return { ok: false, code: "EQUIPMENT_NOT_OWNED" };
    }
    return { ok: true, spec: mergePersonaSpec(current ?? null, "base", itemId) };
  }
  if (!(ATTACHABLE_SLOTS as readonly string[]).includes(slot)) return { ok: false, code: "BAD_REQUEST" };
  if (itemId === null) {
    return { ok: true, spec: mergePersonaSpec(current ?? null, slot as PersonaAttachable, null) };
  }
  const row = SHOP_ITEMS.find((item) => item.id === itemId);
  if (!row) return { ok: false, code: "ITEM_NOT_FOUND" };
  if (row.category !== slot) return { ok: false, code: "ITEM_SLOT_MISMATCH" };
  if (!isOwned(catalogItemKey(row.id))) return { ok: false, code: "EQUIPMENT_NOT_OWNED" };
  return { ok: true, spec: mergePersonaSpec(current ?? null, slot as PersonaAttachable, itemId) };
}

// ── mock endpoint handlers ──────────────────────────────────────────────────

const ERROR_STATUS: Record<Extract<EquipPlanResult, { ok: false }>["code"], number> = {
  BAD_REQUEST: 400,
  INVALID_BASE: 400,
  BASE_REQUIRED: 400,
  ITEM_SLOT_MISMATCH: 400,
  ITEM_NOT_FOUND: 404,
  EQUIPMENT_NOT_OWNED: 403,
};

const ERROR_MESSAGE: Record<Extract<EquipPlanResult, { ok: false }>["code"], string> = {
  BAD_REQUEST: "That slot isn't part of the wardrobe contract.",
  INVALID_BASE: "The house doesn't know that body.",
  BASE_REQUIRED: "Every player needs a body — pick one of the seven.",
  ITEM_SLOT_MISMATCH: "That piece doesn't fit this slot.",
  ITEM_NOT_FOUND: "No such piece behind the counter.",
  EQUIPMENT_NOT_OWNED: "Not yours yet — claim it in the shop first.",
};

export const mockPersona = {
  /** GET /api/me/entitlements — the settings inventory's data spine. */
  async entitlements(): Promise<EntitlementsResponse> {
    return mockFetch<EntitlementsResponse>(
      { entitlements: entitlementRows() },
      { emptyValue: { entitlements: [] }, minDelayMs: 300 },
    );
  },

  /** POST /api/me/equip { slot, itemId } — merges into the persona's spec. */
  async equip(slot: string, itemId: string | null): Promise<EquipAck> {
    const plan = planEquip(slot, itemId, viewerSpec, ownsItemKey);
    if (!plan.ok) {
      const { code } = plan;
      throw new ApiError(code, `(${ERROR_STATUS[code]}) ${ERROR_MESSAGE[code]}`, ERROR_STATUS[code]);
    }
    viewerSpec = plan.spec;
    return mockFetch<EquipAck>({ spec: { ...plan.spec } }, { minDelayMs: 260 });
  },

  /** PUT /api/me/profile { nickname } — the shared sanitizer is the truth. */
  async updateProfile(nickname: string): Promise<ProfileAck> {
    if (typeof nickname !== "string" || nickname.length === 0 || nickname.length > 18) {
      throw new ApiError("BAD_REQUEST", "(400) Nicknames run 1-18 characters.", 400);
    }
    const clean = sanitizeNickname(nickname);
    if (clean === "") {
      throw new ApiError("NICKNAME_REJECTED", "(422) The house won't print that name — pick another.", 422);
    }
    viewerNickname = clean;
    return mockFetch<ProfileAck>({ nickname: clean }, { minDelayMs: 300 });
  },
};

/** Convenience for the UI: all bases the persona may currently equip. */
export function personaOwnedBases(): readonly AvatarBaseId[] {
  return AVATAR_BASE_IDS.filter((base) => isFreeBase(base) || ownsItemKey(catalogItemKey(`body:${base}`)));
}
