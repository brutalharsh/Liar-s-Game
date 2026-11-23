/**
 * Display helpers shared by the auth-facing screens: maps the STR/09
 * `avatarSpec` ({base, hair?, beard?, …}) onto the game UI's Avatar spec
 * ({animal, hat?, glasses?, frame?}). Pure display — the server validates
 * specs, categories and ownership (STR/08 §7).
 */
import type { AdminAvatarSpec } from "@/lib/api";
import type { AvatarAnimal, AvatarSpec } from "@/lib/wire";
import { ANIMALS } from "@/lib/mock/avatar";

const VALID_ANIMALS: readonly string[] = ANIMALS.map((a) => a.id);

export function toDisplaySpec(spec: AdminAvatarSpec | null | undefined): AvatarSpec {
  if (!spec) return { animal: "fox" };
  const animal = (VALID_ANIMALS.includes(spec.base) ? spec.base : "fox") as AvatarAnimal;
  return {
    animal,
    hat: spec.hat,
    glasses: spec.glasses,
    frame: spec.frame,
  };
}

/** Chips for every slot a user has equipped (detail drawer). */
export function specChips(spec: AdminAvatarSpec | null | undefined): { slot: string; value: string }[] {
  if (!spec) return [];
  return Object.entries(spec)
    .filter(([, value]) => value !== undefined && value !== "")
    .map(([slot, value]) => ({ slot, value: String(value) }));
}
