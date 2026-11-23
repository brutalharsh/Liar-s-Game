"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { ShopCategory } from "@/lib/mock/catalog";
import { STARTER_ITEM_IDS } from "@/lib/mock/catalog";
import { apiErrorMessage, getApiMode, getProfile, isApiError } from "@/lib/api";
import { useUiStore } from "@/store/ui";

/**
 * Coin balance + cosmetics. The balance is SERVER-derived: syncCoins() reads
 * GET /api/me through lib/api (never client-authored math — STR/04 §3/06 §3)
 * and re-runs on each Providers mount. In mock mode the same call is served by
 * the fixture adapter, and a signed-out mock session falls back to the
 * adapter's viewer balance so offline dev still shows numbers (the only mock
 * fallback left — the hardcoded MOCK_WALLET is gone).
 * Purchases stay optimistic-local today — every mutation remains the seam the
 * server-validated purchase API hooks into.
 * One equip per category; purchases final; coins cosmetic-only.
 */
export type CoinStatus = "idle" | "syncing" | "synced" | "error";

/** Mirrors the mock adapter's viewer balance (profile-fixtures `coins: 1_240`). */
const MOCK_FALLBACK_COINS = 1_240;

interface EconomyStore {
  coins: number;
  /** Transient (never persisted): did the last profile sync land? */
  coinStatus: CoinStatus;
  /** From the last failed sync — null when synced or never tried. */
  coinError: string | null;
  owned: string[];
  equipped: Record<string, string | undefined>; // category → itemId
  equippedTitle: string | null;
  syncCoins: () => Promise<void>;
  buy: (itemId: string, price: number) => boolean;
  equip: (category: ShopCategory, itemId: string) => void;
  unequip: (category: ShopCategory) => void;
  setTitle: (titleId: string | null) => void;
}

type PersistedEconomy = Pick<EconomyStore, "coins" | "owned" | "equipped" | "equippedTitle">;

let coinSyncInflight: Promise<void> | null = null;

export const useEconomyStore = create<EconomyStore>()(
  persist<EconomyStore, [], [], PersistedEconomy>(
    (set, get) => ({
      coins: 0,
      coinStatus: "idle",
      coinError: null,
      owned: [...STARTER_ITEM_IDS],
      equipped: {},
      equippedTitle: "regular",
      syncCoins: async () => {
        if (coinSyncInflight) return coinSyncInflight;
        coinSyncInflight = (async () => {
          set({ coinStatus: "syncing", coinError: null });
          try {
            const profile = await getProfile();
            set({ coins: profile.coins, coinStatus: "synced" });
          } catch (err) {
            const signedOut = isApiError(err) && err.error === "AUTH_REQUIRED";
            if (signedOut && getApiMode() === "mock") {
              // mock adapter, no demo viewer signed in yet — keep the shop clickable
              set({ coins: MOCK_FALLBACK_COINS, coinStatus: "synced" });
            } else {
              set({
                coinStatus: "error",
                coinError: signedOut
                  ? "Sign in to see your coin balance."
                  : apiErrorMessage(err, "Couldn't load your coin balance."),
              });
              // live mode keeps the last-known (persisted) coins — never fabricated
            }
          } finally {
            coinSyncInflight = null;
          }
        })();
        return coinSyncInflight;
      },
      buy: (itemId, price) => {
        const { coins, owned } = get();
        if (owned.includes(itemId)) return true;
        if (price === 0) {
          set({ owned: [...owned, itemId] });
          return true;
        }
        if (coins < price) {
          useUiStore.getState().push({ title: "Not enough coins", sub: "Win tables to earn more.", tone: "bad" });
          return false;
        }
        set({ coins: coins - price, owned: [...owned, itemId] });
        useUiStore.getState().push({ title: "Purchased!", sub: `−${price} coins`, tone: "good" });
        return true;
      },
      equip: (category, itemId) => {
        set({ equipped: { ...get().equipped, [category]: itemId } });
      },
      unequip: (category) => {
        const next = { ...get().equipped };
        delete next[category];
        set({ equipped: next });
      },
      setTitle: (titleId) => set({ equippedTitle: titleId }),
    }),
    {
      name: "liars-economy",
      skipHydration: true,
      // only durable shop state persists — the sync fields stay transient
      partialize: ({ coins, owned, equipped, equippedTitle }): PersistedEconomy => ({
        coins,
        owned,
        equipped,
        equippedTitle,
      }),
      // Providers rehydrates on mount — after the last-known balance merges in,
      // re-derive it from the profile payload.
      onRehydrateStorage: () => () => {
        void useEconomyStore.getState().syncCoins();
      },
    },
  ),
);
