"use client";

import type { JSX } from "react";
import { Avatar as AvatarDoll } from "@/components/avatar";
import type { AvatarSpec } from "@/lib/wire";

const sizes = {
  xs: 32,
  sm: 40,
  md: 48,
  lg: 64,
  xl: 96,
} as const;

/**
 * The seated-player avatar bubble: the layered SVG paper-doll (components/
 * avatar) wearing the full spec — hat, hair, shirt, glasses and frame render
 * "same to same". An empty seat renders the neutral silhouette.
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
}): JSX.Element {
  return (
    <span
      className={`relative inline-flex items-center justify-center overflow-hidden rounded-full border-2 border-brass-deep bg-felt-deep ${dimmed ? "opacity-60" : ""} ${className}`}
      role="img"
      aria-label={spec ? `avatar ${spec.base}` : "empty seat"}
    >
      <AvatarDoll spec={spec ?? null} size={sizes[size]} />
    </span>
  );
}
