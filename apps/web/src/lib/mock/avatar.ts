import type { AvatarAnimal, AvatarSpec } from "@/lib/wire";
import { COSMETIC_OVERLAYS } from "@/lib/mock/catalog";

/** 12 starter animal avatars (research/09 §1 — nickname + 12 animal presets). */
export const ANIMALS: readonly { id: AvatarAnimal; label: string; emoji: string }[] = [
  { id: "fox", label: "Fox", emoji: "🦊" },
  { id: "wolf", label: "Wolf", emoji: "🐺" },
  { id: "bear", label: "Bear", emoji: "🐻" },
  { id: "owl", label: "Owl", emoji: "🦉" },
  { id: "eagle", label: "Eagle", emoji: "🦅" },
  { id: "deer", label: "Deer", emoji: "🦌" },
  { id: "raccoon", label: "Raccoon", emoji: "🦝" },
  { id: "boar", label: "Boar", emoji: "🐗" },
  { id: "cat", label: "Cat", emoji: "🐈" },
  { id: "rabbit", label: "Rabbit", emoji: "🐇" },
  { id: "gator", label: "Gator", emoji: "🐊" },
  { id: "snake", label: "Snake", emoji: "🐍" },
] as const;

export function animalEmoji(animal: AvatarAnimal): string {
  return ANIMALS.find((a) => a.id === animal)?.emoji ?? "🦊";
}

export function animalLabel(animal: AvatarAnimal): string {
  return ANIMALS.find((a) => a.id === animal)?.label ?? "Player";
}

export function randomAnimal(rng: () => number): AvatarAnimal {
  const idx = Math.floor(rng() * ANIMALS.length);
  return ANIMALS[Math.min(idx, ANIMALS.length - 1)]?.id ?? "fox";
}

export function emojiForSpec(spec: AvatarSpec | null | undefined): string {
  if (!spec) return "🪑";
  return animalEmoji(spec.animal);
}

/** Overlay emoji for an equipped cosmetic id (mock preview art). */
export function overlayEmoji(cosmeticId: string | undefined): string | null {
  if (!cosmeticId) return null;
  return COSMETIC_OVERLAYS[cosmeticId] ?? null;
}
