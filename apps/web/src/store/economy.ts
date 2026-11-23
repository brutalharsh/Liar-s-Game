"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { ShopCategory } from "@/lib/mock/catalog";
import { STARTER_ITEM_IDS } from "@/lib/mock/catalog";
import { MOCK_WALLET } from "@/lib/mock/profile";
import { useUiStore } from "@/store/ui";

/**
 * Mock wallet + cosmetics (mirrors GET /api/me + server-validated purchases;
 * every mutation here is a seam the real API hooks into — STR/04 §3).
 * One equip per category; purchases final; coins cosmetic-only.
 */
interface EconomyStore {
  coins: number;
  owned: string[];
  equipped: Record<string, string | undefined>; // category → itemId
  equippedTitle: string | null;
  buy: (itemId: string, price: number) => boolean;
  equip: (category: ShopCategory, itemId: string) => void;
  unequip: (category: ShopCategory) => void;
  setTitle: (titleId: string | null) => void;
}

export const useEconomyStore = create<EconomyStore>()(
  persist(
    (set, get) => ({
      coins: MOCK_WALLET.startingCoins,
      owned: [...STARTER_ITEM_IDS],
      equipped: {},
      equippedTitle: "regular",
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
    },
  ),
);
