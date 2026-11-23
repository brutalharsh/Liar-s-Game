"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { AvatarAnimal, AvatarSpec } from "@/lib/wire";
import { randomAnimal } from "@/lib/mock/avatar";
import { mockRng } from "@/lib/mock/rng";

/** Local identity (localStorage) — claim-to-account later (STR/02 v1.x). */
interface IdentityStore {
  nickname: string;
  avatar: AvatarSpec;
  setNickname: (nickname: string) => void;
  setAvatar: (avatar: AvatarSpec) => void;
  setAnimal: (animal: AvatarAnimal) => void;
}

export const useIdentityStore = create<IdentityStore>()(
  persist(
    (set) => ({
      nickname: "",
      avatar: { animal: "fox" },
      setNickname: (nickname) => set({ nickname }),
      setAvatar: (avatar) => set({ avatar }),
      setAnimal: (animal) => set((s) => ({ avatar: { ...s.avatar, animal } })),
    }),
    {
      name: "liars-identity",
      skipHydration: true,
    },
  ),
);

/** Random starter animal for the create screen "shuffle". */
export function randomStarterAnimal(): AvatarAnimal {
  return randomAnimal(mockRng);
}
