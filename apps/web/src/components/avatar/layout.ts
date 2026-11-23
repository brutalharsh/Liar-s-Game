/**
 * Avatar engine foundation — geometry anchors + the color tokens.
 *
 * Everything visual lives here or in catalog-parts.ts (STR/05 §2: tokens, not
 * hex soups): parts reference these constants only, and every color is a
 * CSS custom property with a fallback so themes can retune the doll later.
 *
 * Canonical drawing bands (viewBox 100×100), shared by ALL bodies so every
 * wearable fits every base:
 *   head  : ellipse (headCx, headCy, headRx, headRy)  — eyes at headCy
 *   chin  : headCy + headRy                           — beards hang from here
 *   crown : headCy - headRy                           — hair caps + hat brims
 *   torso : shoulderY … waistY (half-widths at each band drive the silhouette)
 */
import type { AttachableSlot, AvatarBaseId } from "@/lib/wire";

// ── geometry ────────────────────────────────────────────────────────────────

export interface BodyGeometry {
  headCx: number;
  headCy: number;
  headRx: number;
  headRy: number;
  shoulderY: number;
  shoulderHalf: number;
  waistY: number;
  waistHalf: number;
  hipHalf: number;
  armW: number;
  legW: number;
}

const HUMAN_BASE: Omit<BodyGeometry, "shoulderHalf" | "waistHalf" | "hipHalf" | "armW"> = {
  headCx: 50,
  headCy: 27,
  headRx: 12,
  headRy: 12.5,
  shoulderY: 45.5,
  waistY: 73,
  legW: 7.5,
};

/**
 * Per-base geometry — the ONLY place silhouettes differ. thin vs gym is read
 * through `shoulderHalf`/`armW` (gym = broader shoulders, heavier arms);
 * female = narrower frame with a fuller hip line. Species get species heads.
 */
export const BASE_GEOMETRY: Record<AvatarBaseId, BodyGeometry> = {
  "human-male-thin": { ...HUMAN_BASE, shoulderHalf: 14.5, waistHalf: 10, hipHalf: 10.5, armW: 6 },
  "human-female-thin": { ...HUMAN_BASE, shoulderHalf: 11.5, waistHalf: 8.5, hipHalf: 11, armW: 5 },
  "human-male-gym": { ...HUMAN_BASE, shoulderHalf: 19, waistHalf: 12.5, hipHalf: 12, armW: 8 },
  "human-female-gym": { ...HUMAN_BASE, shoulderHalf: 15, waistHalf: 10, hipHalf: 11.5, armW: 6.5 },
  dog: {
    headCx: 50,
    headCy: 26.5,
    headRx: 13,
    headRy: 12,
    shoulderY: 45.5,
    waistY: 73,
    shoulderHalf: 13.5,
    waistHalf: 10,
    hipHalf: 10.5,
    armW: 5.5,
    legW: 7,
  },
  cat: {
    headCx: 50,
    headCy: 26.5,
    headRx: 12.5,
    headRy: 11.5,
    shoulderY: 45.5,
    waistY: 73,
    shoulderHalf: 11.5,
    waistHalf: 8.5,
    hipHalf: 10,
    armW: 5,
    legW: 6.5,
  },
  horse: {
    headCx: 50,
    headCy: 26,
    headRx: 11.5,
    headRy: 14,
    shoulderY: 45.5,
    waistY: 73,
    shoulderHalf: 15.5,
    waistHalf: 11,
    hipHalf: 11.5,
    armW: 6,
    legW: 7.5,
  },
};

/**
 * Per-base wearable offsets (mission: "where a species head differs, per-base
 * anchor offsets in a small layout map"). `dy` is a viewBox-unit nudge so a
 * hat clears a species' ears/muzzle just so. Humans all ride 0.
 */
export const PART_ADJUST: Record<AvatarBaseId, Partial<Record<AttachableSlot, { dy: number }>>> = {
  "human-male-thin": {},
  "human-female-thin": {},
  "human-male-gym": {},
  "human-female-gym": {},
  dog: { hat: { dy: -1 } },
  cat: { hat: { dy: -1.5 } },
  horse: { hat: { dy: -1.5 }, hair: { dy: -1.5 } },
};

/** Geometry a part draws against when no base is known (thumbs, silhouette). */
export const NEUTRAL_GEOMETRY: BodyGeometry = BASE_GEOMETRY["human-male-thin"];

// ── palette (tokens with fallbacks — STR/05 §2) ────────────────────────────

const token = (name: string, fallback: string): string => `var(--av-${name}, ${fallback})`;

/**
 * The whole engine's color truth. Parf Star overrides any `--av-*` custom
 * property to re-skin the dolls; fallbacks keep renders deterministic in
 * node/tests (no CSS context needed).
 */
export const AVATAR_PALETTE = {
  outline: token("outline", "#33241b"),
  // humans
  skin: token("skin", "#e2ab7b"),
  skinShade: token("skin-shade", "#c98d5f"),
  ink: token("ink", "#2a1d14"),
  blush: token("blush", "#d98f74"),
  // species fur coats (one base coat per base — see BODIES below)
  dogFur: token("dog-fur", "#a97c50"),
  dogFurShade: token("dog-fur-shade", "#8a6238"),
  bearFur: token("bear-fur", "#7a5233"),
  foxFur: token("fox-fur", "#d97a3a"),
  foxFurShade: token("fox-fur-shade", "#b35b22"),
  wolfFur: token("wolf-fur", "#9aa2ad"),
  wolfFurShade: token("wolf-fur-shade", "#767d88"),
  catFur: token("cat-fur", "#8f939e"),
  catFurShade: token("cat-fur-shade", "#6f7480"),
  catInnerEar: token("cat-inner-ear", "#e8a0a8"),
  catEye: token("cat-eye", "#7fae4c"),
  horseFur: token("horse-fur", "#a3744a"),
  horseFurShade: token("horse-fur-shade", "#7f5433"),
  mane: token("mane", "#4a3220"),
  // hair + beard dye tones
  hairDark: token("hair-dark", "#4a3122"),
  hairBrown: token("hair-brown", "#7a4a2b"),
  hairBlack: token("hair-black", "#2c2320"),
  hairGinger: token("hair-ginger", "#b5502a"),
  hairSilver: token("hair-silver", "#c9c4bc"),
  hairIvory: token("hair-ivory", "#f2e8d5"),
  beardInk: token("beard-ink", "#3d2a1e"),
  // wardrobe neutrals + accents
  clothWhite: token("cloth-white", "#f4efe4"),
  clothRed: token("cloth-red", "#a63a2e"),
  clothNavy: token("cloth-navy", "#2e3a4a"),
  denim: token("denim", "#46587a"),
  denimShade: token("denim-shade", "#374663"),
  leather: token("leather", "#6b4a2f"),
  leatherShade: token("leather-shade", "#52351f"),
  feltTan: token("felt-tan", "#c9a15f"),
  feltBrown: token("felt-brown", "#8a6238"),
  hatBand: token("hat-band", "#4a3220"),
  brass: "var(--color-brass, #d4af37)",
  brassDeep: "var(--color-brass-deep, #8f7420)",
  lamp: "var(--color-lamp, #ffd166)",
  ivory: "var(--color-ivory, #f2e8d5)",
  feltDeep: "var(--color-felt-deep, #142a1e)",
  wood: "var(--color-wood, #5a3d28)",
  neonPink: token("neon-pink", "#ff4fd8"),
  neonCyan: token("neon-cyan", "#6ee7ff"),
  gemRuby: token("gem-ruby", "#c0344c"),
  prestigeBronze: token("prestige-bronze", "#b0763b"),
  prestigeSilver: token("prestige-silver", "#c9cdd4"),
  prestigeGold: token("prestige-gold", "#e5b93c"),
  prestigeDiamond: token("prestige-diamond", "#a8e6ee"),
  metalShine: token("metal-shine", "#ffffff"),
  glassTint: token("glass-tint", "#2b2b33"),
  // neutral placeholder + silhouette
  placeholder: token("placeholder", "#8a978b"),
  placeholderShade: token("placeholder-shade", "#6d7a6e"),
  silhouette: token("silhouette", "#7d8a80"),
  bottoms: token("bottoms", "#3a2e26"),
} as const;

export type AvatarColor = keyof typeof AVATAR_PALETTE;

/** Resolve a palette entry to its CSS-var-with-fallback string for fill/stroke. */
export function av(color: AvatarColor): string {
  return AVATAR_PALETTE[color];
}
