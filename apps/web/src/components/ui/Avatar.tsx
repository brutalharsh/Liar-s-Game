"use client";

import type { AvatarAnimal, AvatarSpec } from "@/lib/wire";
import { animalEmoji } from "@/lib/mock/avatar";
import { overlayEmoji } from "@/lib/mock/avatar";

const sizes = {
  xs: "h-8 w-8 text-lg",
  sm: "h-10 w-10 text-xl",
  md: "h-12 w-12 text-2xl",
  lg: "h-16 w-16 text-4xl",
  xl: "h-24 w-24 text-6xl",
} as const;

/**
 * Animal avatar + equipped cosmetics overlay. All emoji, zero image assets —
 * real avatar art lands with the asset wave.
 */
export function Avatar({
  spec,
  size = "md",
  className = "",
  dimmed = false,
}: {
  spec: AvatarSpec | null;
  size?: keyof typeof sizes;
  className?: string;
  dimmed?: boolean;
}) {
  const frame = spec?.frame ? overlayEmoji(spec.frame) : null;
  return (
    <span
      className={`relative inline-flex items-center justify-center rounded-full border-2 border-brass-deep bg-felt-deep ${sizes[size]} ${dimmed ? "opacity-60" : ""} ${className}`}
      role="img"
      aria-label={spec ? `avatar ${spec.animal}` : "empty seat"}
    >
      <span aria-hidden>{spec ? animalEmoji(spec.animal) : "🪑"}</span>
      {spec?.hat && (
        <span aria-hidden className="absolute -top-2 left-1/2 -translate-x-1/2 text-sm drop-shadow">
          {overlayEmoji(spec.hat) ?? ""}
        </span>
      )}
      {spec?.glasses && (
        <span aria-hidden className="absolute bottom-1/4 left-1/2 -translate-x-1/2 text-[0.65em] drop-shadow">
          {overlayEmoji(spec.glasses) ?? ""}
        </span>
      )}
      {frame && (
        <span aria-hidden className="absolute -inset-1.5 rounded-full border-2 border-dashed text-[0.55em] text-brass">
          <span className="absolute -top-1 right-0.5 text-xs">{frame}</span>
        </span>
      )}
    </span>
  );
}

export function animalOption(animal: AvatarAnimal): { label: string; emoji: string } {
  return { label: animal, emoji: animalEmoji(animal) };
}
