import type { ThemeId } from "@/lib/wire";

/**
 * Theme registry (STR/04 §4). CSS variable overrides live in globals.css
 * under `[data-theme="…"]` — this file carries only display metadata + the
 * swatch tokens used by previews (theme packs swap CSS vars, STR/05 §2).
 */

export interface ThemeMeta {
  id: ThemeId;
  name: string;
  free: boolean;
  price: number; // coins (premium themes)
  desc: string;
  swatch: { felt: string; accent: string; wood: string };
  particle: string;
}

export const THEMES: readonly ThemeMeta[] = [
  {
    id: "saloon",
    name: "The Saloon",
    free: true,
    price: 0,
    desc: "Whiskey-amber felt, piano-rag in the back. The house classic.",
    swatch: { felt: "#1d3a2a", accent: "#e8a54b", wood: "#2a1a12" },
    particle: "dust",
  },
  {
    id: "house",
    name: "House Table",
    free: true,
    price: 0,
    desc: "Living-room felt under a shaded lamp. Familiar and dangerous.",
    swatch: { felt: "#2c4a33", accent: "#d9b36a", wood: "#3b2a1a" },
    particle: "dust",
  },
  {
    id: "neon",
    name: "Neon District",
    free: false,
    price: 500,
    desc: "Cyberpunk felt, magenta neon, synthwave hum.",
    swatch: { felt: "#191b33", accent: "#4fd8e8", wood: "#120f26" },
    particle: "neon",
  },
  {
    id: "royale",
    name: "Casino Royale",
    free: false,
    price: 700,
    desc: "Deep casino green and gilt trim. Fancy ways to lose.",
    swatch: { felt: "#0f3325", accent: "#ffd700", wood: "#1a1214" },
    particle: "dust",
  },
  {
    id: "speakeasy",
    name: "Jazz Speakeasy",
    free: false,
    price: 600,
    desc: "Sepia smoke, saxophone, one dim bulb.",
    swatch: { felt: "#2b2118", accent: "#c9a15f", wood: "#1c1410" },
    particle: "embers",
  },
  {
    id: "haunted",
    name: "Haunted Inn",
    free: false,
    price: 450,
    desc: "The candles watch you back.",
    swatch: { felt: "#1a2420", accent: "#7fd18a", wood: "#141014" },
    particle: "embers",
  },
  {
    id: "orbital",
    name: "Orbital Cantina",
    free: false,
    price: 800,
    desc: "Bluffing at zero gravity. Mind the airlock.",
    swatch: { felt: "#101c2c", accent: "#6ee7ff", wood: "#0c1018" },
    particle: "neon",
  },
  {
    id: "kabuki",
    name: "Kabuki Alley",
    free: false,
    price: 650,
    desc: "Lanterns, drums and face paint.",
    swatch: { felt: "#33141c", accent: "#ff6b81", wood: "#1c1014" },
    particle: "embers",
  },
] as const;

export function themeMeta(id: ThemeId): ThemeMeta {
  return THEMES.find((t) => t.id === id) ?? (THEMES[0] as ThemeMeta);
}

export const DEFAULT_THEME: ThemeId = "saloon";
