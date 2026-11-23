"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { AvatarAnimal, AvatarSpec } from "@/lib/wire";
import { randomAnimal } from "@/lib/mock/avatar";
import { mockRng } from "@/lib/mock/rng";

/** Guest identity (localStorage) — claim-to-account later (STR/02 v1.x). */
interface IdentityStore {
  guestToken: string;
  nickname: string;
  avatar: AvatarSpec;
  setNickname: (nickname: string) => void;
  setAvatar: (avatar: AvatarSpec) => void;
  setAnimal: (animal: AvatarAnimal) => void;
}

function makeGuestToken(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `guest-${Date.now()}-${Math.floor(mockRng() * 1e9)}`;
}

export const useIdentityStore = create<IdentityStore>()(
  persist(
    (set) => ({
      guestToken: "",
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

export function ensureGuestToken(): string {
  const id = useIdentityStore.getState().guestToken;
  if (id) return id;
  const fresh = makeGuestToken();
  useIdentityStore.setState({ guestToken: fresh });
  return fresh;
}

/** Random starter animal for the create screen "shuffle". */
export function randomStarterAnimal(): AvatarAnimal {
  return randomAnimal(mockRng);
}
