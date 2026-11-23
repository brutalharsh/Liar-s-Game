"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  equipSlot,
  getCatalogPage,
  getEntitlements,
  getProfile,
  isApiError,
  ownsCatalogItem,
  updateProfile,
  ApiError,
  type AdminAvatarSpec,
  type CatalogPage,
  type EntitlementsResponse,
  type EquipSlot,
  type ProfileResponse,
  type PublicCatalogItem,
  type UserEntitlement,
} from "@/lib/api";
import { AVATAR_BASE_IDS, type AvatarBaseId } from "@/lib/wire";
import { FREE_BASES } from "@/lib/mock/persona";
import { titleName } from "@/lib/mock/titles";
import { toDisplaySpec } from "@/components/auth/viewer";
import { useMockQuery } from "@/hooks/useMockQuery";
import { useAuthStore } from "@/store/auth-store";
import type { AvatarSpec } from "@/lib/wire";

/**
 * ============================================================================
 * SETTINGS DATA — one provider behind every dashboard section (T4)
 * ============================================================================
 * Loads the settings trio (GET /api/me · /api/me/entitlements · /api/catalog)
 * once per dashboard mount and OWNS the viewer's live avatar spec mirror:
 * equips apply optimistically, roll back on failure, and adopt the server's
 * returned spec on success (the ack is the only truth). The header session
 * refreshes on every landed mutation so the SiteHeader avatar wears the
 * change "same to same" everywhere on the next paint.
 * ============================================================================
 */

export type SlotName = "hair" | "beard" | "hat" | "shirt" | "glasses";

export interface BaseRow {
  base: AvatarBaseId;
  name: string;
  price: number | null; // null = not in the catalog (server unseeded)
  free: boolean;
  owned: boolean;
  equipped: boolean;
  catalogId: string | null;
}

export interface SettingsData {
  /** One of while the trio loads — sections render their own skeletons. */
  phase: "loading" | "error" | "ready";
  error: Error | null;
  apiError: ApiError | null;
  banned: boolean;
  retry(): void;

  profile: ProfileResponse | null;
  entitlements: UserEntitlement[];
  catalog: PublicCatalogItem[];

  /** Live mirror of the viewer's avatar spec (server-shaped). */
  spec: AdminAvatarSpec | null;
  /** The same spec as the paper-doll display view-model (drops anim/voice). */
  displaySpec: AvatarSpec | null;
  /** A mutation is in flight (single-flight; buttons disable while true). */
  busy: boolean;

  equip(slot: EquipSlot, itemId: string | null): Promise<{ ok: true } | { ok: false; error: ApiError }>;
  saveNickname(nickname: string): Promise<{ ok: true; nickname: string } | { ok: false; error: ApiError }>;

  // ── derived helpers (catalog + entitlements + spec, pre-joined) ──
  itemName(id: string): string;
  slotItems(slot: SlotName): PublicCatalogItem[];
  owns(itemId: string): boolean;
  isEquipped(slot: SlotName | "frame" | "base", itemId: string): boolean;
  equippedIn(slot: SlotName | "frame"): string | null;
  baseRows: BaseRow[];
  themeOwned(themeId: string): boolean;
  ownedTitles(): { key: string; name: string }[];
}

const SettingsContext = createContext<SettingsData | null>(null);

const BASE_LABELS: Record<AvatarBaseId, string> = {
  "human-male-thin": "Thin Build (Male)",
  "human-female-thin": "Thin Build (Female)",
  "human-male-gym": "Gym Build (Male)",
  "human-female-gym": "Gym Build (Female)",
  dog: "Dog",
  cat: "Cat",
  horse: "Horse",
};

/** Flat one-slot merge — the client-side twin of the server's merge rule. */
export function mergeSpecForUI(
  current: AdminAvatarSpec | null,
  slot: EquipSlot,
  itemId: string | null,
): AdminAvatarSpec {
  const next: AdminAvatarSpec = { ...(current ?? { base: "human-male-thin" }) };
  if (slot === "base") {
    if (itemId !== null) next.base = itemId;
    return next;
  }
  if (itemId === null) delete next[slot];
  else next[slot] = itemId;
  return next;
}

export function SettingsDataProvider({ children }: { children: ReactNode }): ReactNode {
  const profileQuery = useMockQuery<ProfileResponse>(() => getProfile(), []);
  const entsQuery = useMockQuery<EntitlementsResponse>(() => getEntitlements(), []);
  const catalogQuery = useMockQuery<CatalogPage>(() => getCatalogPage(), []);
  const fetchMe = useAuthStore((s) => s.fetchMe);

  const [spec, setSpec] = useState<AdminAvatarSpec | null>(null);
  const [busy, setBusy] = useState(false);
  const seededRef = useRef(false);

  const profile = profileQuery.data;
  const entitlements = entsQuery.data?.entitlements ?? [];
  const catalog = catalogQuery.data?.items ?? [];

  // Adopt the incoming server spec once the profile read lands; after that
  // the mirror is owned by the equip flow (ack-driven), not by refetches.
  useEffect(() => {
    if (profile && !seededRef.current) {
      seededRef.current = true;
      setSpec(profile.user.avatarSpec);
    }
  }, [profile]);

  // The session died under us (AuthGate probe raced a logout) — hand the
  // route back to the gate, exactly like the profile page does.
  const signedOut = isApiError(profileQuery.error) && profileQuery.error.error === "AUTH_REQUIRED";
  useEffect(() => {
    if (signedOut) void fetchMe(true);
  }, [signedOut, fetchMe]);

  const equip = useCallback(
    async (slot: EquipSlot, itemId: string | null): Promise<{ ok: true } | { ok: false; error: ApiError }> => {
      const before = spec;
      const optimistic = mergeSpecForUI(before, slot, itemId);
      setBusy(true);
      if (before) setSpec(optimistic); // laptop-free optimism; rollback below
      try {
        const ack = await equipSlot({ slot, itemId });
        setSpec(ack.spec);
        void fetchMe(true); // header + session chips wear it too
        return { ok: true };
      } catch (err) {
        setSpec(before); // rollback — the server never accepted it
        if (isApiError(err)) return { ok: false, error: err };
        return {
          ok: false,
          error: new ApiError("NETWORK", "Can't reach the fitting room right now.", 0) as ApiError,
        };
      } finally {
        setBusy(false);
      }
    },
    [spec, fetchMe],
  );

  const saveNickname = useCallback(
    async (nickname: string): Promise<{ ok: true; nickname: string } | { ok: false; error: ApiError }> => {
      setBusy(true);
      try {
        const ack = await updateProfile({ nickname });
        profileQuery.reload(); // the summary line reads /api/me — refresh it
        void fetchMe(true); // header shows the new name immediately
        return { ok: true, nickname: ack.nickname };
      } catch (err) {
        if (isApiError(err)) return { ok: false, error: err };
        return {
          ok: false,
          error: new ApiError("NETWORK", "Can't reach the front desk right now.", 0) as ApiError,
        };
      } finally {
        setBusy(false);
      }
    },
    [fetchMe, profileQuery],
  );

  const value = useMemo<SettingsData>(() => {
    const catalogById = new Map(catalog.map((item) => [item._id, item]));
    const ownedSet = new Set(
      entitlements.filter((e) => e.kind === "item").map((e) => e.key as string),
    );
    const themeSet = new Set(entitlements.filter((e) => e.kind === "theme").map((e) => e.key as string));

    const baseRows: BaseRow[] = AVATAR_BASE_IDS.map((base) => {
      const free = FREE_BASES.includes(base);
      const row = catalogById.get(`body:${base}`) ?? null;
      return {
        base,
        name: row?.name ?? BASE_LABELS[base],
        price: row ? row.price : free ? 0 : null,
        free,
        owned: free || ownedSet.has(base),
        equipped: (spec?.base ?? "human-male-thin") === base,
        catalogId: row ? row._id : null,
      };
    });

    return {
      phase: profileQuery.loading || entsQuery.loading || catalogQuery.loading
        ? "loading"
        : profileQuery.error || entsQuery.error || catalogQuery.error
          ? "error"
          : "ready",
      error: profileQuery.error ?? entsQuery.error ?? catalogQuery.error ?? null,
      apiError: isApiError(profileQuery.error)
        ? profileQuery.error
        : isApiError(entsQuery.error)
          ? entsQuery.error
          : null,
      banned: isApiError(profileQuery.error) && profileQuery.error.error === "BANNED",
      retry: () => {
        profileQuery.reload();
        entsQuery.reload();
        catalogQuery.reload();
      },
      profile,
      entitlements,
      catalog,
      spec,
      displaySpec: toDisplaySpec(spec),
      busy,
      equip,
      saveNickname,
      itemName: (id: string) => catalogById.get(id)?.name ?? id,
      slotItems: (slot: SlotName) =>
        catalog
          .filter((item) => item.category === slot && item.active !== false)
          .slice()
          .sort((a, b) => {
            const ao = ownsCatalogItem(entitlements, a._id) ? 0 : 1;
            const bo = ownsCatalogItem(entitlements, b._id) ? 0 : 1;
            return ao - bo || a.price - b.price || a.name.localeCompare(b.name);
          }),
      owns: (itemId: string) => ownsCatalogItem(entitlements, itemId),
      isEquipped: (slot, itemId) => {
        if (slot === "base") return (spec?.base ?? "") === itemId;
        return (spec?.[slot] ?? null) === itemId;
      },
      equippedIn: (slot) => spec?.[slot] ?? null,
      baseRows,
      themeOwned: (themeId: string) => themeSet.has(themeId),
      ownedTitles: () =>
        entitlements
          .filter((e) => e.kind === "title")
          .map((e) => ({ key: e.key as string, name: titleName(e.key as string) ?? (e.key as string) })),
    };
  }, [profile, entitlements, catalog, spec, busy, equip, saveNickname, profileQuery, entsQuery, catalogQuery]);

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettingsData(): SettingsData {
  const ctx = useContext(SettingsContext);
  if (!ctx) {
    throw new Error("useSettingsData must be used inside <SettingsDataProvider>");
  }
  return ctx;
}
