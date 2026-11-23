"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { DEFAULT_AVATAR_BASE, type AvatarAnimal, type AvatarSpec } from "@/lib/wire";
import { randomAnimal } from "@/lib/mock/avatar";
import { mockRng } from "@/lib/mock/rng";

/** Local identity (localStorage) — claim-to-account later (STR/02 v1.x). */
interface IdentityStore {
  nickname: string;
  avatar: AvatarSpec;
  setNickname: (nickname: string) => void;
  setAvatar: (avatar: AvatarSpec) => void;
}

/** What actually persists (data only — actions stay transient, economy-style). */
interface PersistedIdentity {
  nickname: string;
  avatar: AvatarSpec;
}

interface LegacyAvatarV0 {
  animal?: unknown;
  hat?: unknown;
  glasses?: unknown;
  frame?: unknown;
}

/**
 * v0 (pre-paper-doll) persisted `avatar: { animal: 'fox', … }` → the flat
 * spec contract. The legacy animal slug rides as `base` and the engine's
 * bridge renders it; once the avatar editor lands, a re-save normalizes it.
 */
function migrateIdentity(persisted: unknown): PersistedIdentity {
  const state = persisted as Partial<PersistedIdentity> | undefined;
  const legacy = state?.avatar as LegacyAvatarV0 | undefined;
  if (!legacy || typeof legacy.animal !== "string") {
    return {
      nickname: typeof state?.nickname === "string" ? state.nickname : "",
      avatar: { base: DEFAULT_AVATAR_BASE },
    };
  }
  const avatar: AvatarSpec = {
    base: legacy.animal,
    ...(typeof legacy.hat === "string" ? { hat: legacy.hat } : {}),
    ...(typeof legacy.glasses === "string" ? { glasses: legacy.glasses } : {}),
    ...(typeof legacy.frame === "string" ? { frame: legacy.frame } : {}),
  };
  return {
    nickname: typeof state?.nickname === "string" ? state.nickname : "",
    avatar,
  };
}

export const useIdentityStore = create<IdentityStore>()(
  persist(
    (set) => ({
      nickname: "",
      avatar: { base: DEFAULT_AVATAR_BASE },
      setNickname: (nickname) => set({ nickname }),
      setAvatar: (avatar) => set({ avatar }),
    }),
    {
      name: "liars-identity",
      version: 1,
      skipHydration: true,
      partialize: ({ nickname, avatar }): PersistedIdentity => ({ nickname, avatar }),
      migrate: (persisted) => migrateIdentity(persisted),
    },
  ),
);

/** Random starter animal for the create screen "shuffle". */
export function randomStarterAnimal(): AvatarAnimal {
  return randomAnimal(mockRng);
}
