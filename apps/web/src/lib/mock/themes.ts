import type { ThemeId } from "@/lib/wire";

/**
 * Theme registry (STR/04 §4). CSS variable overrides live in globals.css
 * under `[data-theme="…"]` — this file carries only display metadata + the
 * swatch tokens used by previews (theme packs swap CSS vars, STR/05 §2).
 * Swatches mirror the CURRENT noir pack blocks in globals.css:
 *   felt/wood = the pack's surface tones, accent = the pack's PRIMARY
 *   accent (the brass family per pack — the canonical noir red #d92d20
 *   where the pack doesn't override it).
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
    swatch: { felt: "#161412", accent: "#d92d20", wood: "#131110" },
    particle: "dust",
  },
  {
    id: "house",
    name: "House Table",
    free: true,
    price: 0,
    desc: "Living-room felt under a shaded lamp. Familiar and dangerous.",
    swatch: { felt: "#151515", accent: "#d92d20", wood: "#121212" },
    particle: "dust",
  },
  {
    id: "neon",
    name: "Neon District",
    free: false,
    price: 500,
    desc: "Cyberpunk felt, magenta neon, synthwave hum.",
    swatch: { felt: "#11121c", accent: "#ff4fd8", wood: "#101019" },
    particle: "neon",
  },
  {
    id: "royale",
    name: "Casino Royale",
    free: false,
    price: 700,
    desc: "Deep casino green and gilt trim. Fancy ways to lose.",
    swatch: { felt: "#1a0d12", accent: "#c12233", wood: "#12090b" },
    particle: "dust",
  },
  {
    id: "speakeasy",
    name: "Jazz Speakeasy",
    free: false,
    price: 600,
    desc: "Sepia smoke, saxophone, one dim bulb.",
    swatch: { felt: "#171411", accent: "#d92d20", wood: "#131110" },
    particle: "embers",
  },
  {
    id: "haunted",
    name: "Haunted Inn",
    free: false,
    price: 450,
    desc: "The candles watch you back.",
    swatch: { felt: "#121815", accent: "#9fb8a6", wood: "#0e1210" },
    particle: "embers",
  },
  {
    id: "orbital",
    name: "Orbital Cantina",
    free: false,
    price: 800,
    desc: "Bluffing at zero gravity. Mind the airlock.",
    swatch: { felt: "#0e1219", accent: "#6ee7ff", wood: "#0b0e14" },
    particle: "neon",
  },
  {
    id: "kabuki",
    name: "Kabuki Alley",
    free: false,
    price: 650,
    desc: "Lanterns, drums and face paint.",
    swatch: { felt: "#1b0e11", accent: "#df3c1f", wood: "#13090b" },
    particle: "embers",
  },
] as const;

export function themeMeta(id: ThemeId): ThemeMeta {
  return THEMES.find((t) => t.id === id) ?? (THEMES[0] as ThemeMeta);
}

export const DEFAULT_THEME: ThemeId = "saloon";
