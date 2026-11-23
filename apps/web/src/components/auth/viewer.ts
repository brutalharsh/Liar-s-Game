/**
 * Display helpers shared by the auth-facing screens: maps the STR/09
 * `avatarSpec` ({base, hair?, beard?, …}) onto the UI's display spec (the
 * same flat shape — the paper-doll renders it directly). Pure display — the
 * server validates specs, categories and ownership (STR/08 §7).
 */
import type { AdminAvatarSpec } from "@/lib/api";
import type { AvatarSpec } from "@/lib/wire";

export function toDisplaySpec(spec: AdminAvatarSpec | null | undefined): AvatarSpec | null {
  if (!spec) return null;
  return {
    base: spec.base,
    hair: spec.hair,
    beard: spec.beard,
    hat: spec.hat,
    shirt: spec.shirt,
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
