/**
 * Paper-doll body layers — the 7 canonical bases (humans cross sex × build,
 * upright species) + the neutral silhouette fallback.
 *
 * Style law (STR/05): flat-color, minimal-geometric, respectful, no realism.
 * Every body is built from the SAME drawing bands (layout.ts) so all
 * wearables fit all bases; only silhouette geometry + coat colors differ.
 */
import type { JSX } from "react";
import { AVATAR_PALETTE as C, type BodyGeometry } from "../layout";

export interface HumanCoat {
  skin: string;
  shade: string;
}

export interface SpeciesCoat {
  fur: string;
  shade: string;
  /** inner-ear / nose pink */
  inner: string;
  /** muzzle cream */
  muzzle: string;
}

const OUTLINE = { stroke: C.outline, strokeWidth: 1.4 } as const;

// ── shared skeleton pieces ──────────────────────────────────────────────────

/** Rounded torso: shoulder shelf → hip flare, widths straight from geometry. */
export function torsoPath(g: BodyGeometry): string {
  const { headCx: cx, shoulderY: sy, shoulderHalf: sh, waistY: wy, hipHalf: hip } = g;
  const innerShoulder = sh - 2.5;
  return [
    `M ${cx - innerShoulder} ${sy}`,
    `L ${cx + innerShoulder} ${sy}`,
    `C ${cx + sh} ${sy + 3} ${cx + hip} ${wy - 7} ${cx + hip} ${wy + 3.5}`,
    `L ${cx - hip} ${wy + 3.5}`,
    `C ${cx - hip} ${wy - 7} ${cx - sh} ${sy + 3} ${cx - innerShoulder} ${sy}`,
    "Z",
  ].join(" ");
}

/** Legs + saloon boots (two round strokes under the hip line). */
function Legs({ g, color }: { g: BodyGeometry; color: string }): JSX.Element {
  const { headCx: cx, waistY: wy, legW } = g;
  const x = 4.6;
  return (
    <g>
      <line x1={cx - x} y1={wy} x2={cx - x} y2={89} stroke={color} strokeWidth={legW} strokeLinecap="round" />
      <line x1={cx + x} y1={wy} x2={cx + x} y2={89} stroke={color} strokeWidth={legW} strokeLinecap="round" />
      <ellipse cx={cx - x - 1} cy={90.6} rx={4.6} ry={2.5} fill={C.hatBand} {...OUTLINE} />
      <ellipse cx={cx + x + 1} cy={90.6} rx={4.6} ry={2.5} fill={C.hatBand} {...OUTLINE} />
    </g>
  );
}

/** Arm stroke `d` for one side — shared with shirt sleeves (they redraw it). */
export function armPathD(g: BodyGeometry, side: "left" | "right"): string {
  const { headCx: cx, shoulderY: sy, shoulderHalf: sh } = g;
  const outward = sh <= 12 ? 1.2 : 2.6;
  return side === "left"
    ? `M ${cx - sh + 1.5} ${sy + 3.5} Q ${cx - sh - outward} ${sy + 14} ${cx - sh + 0.5} ${sy + 25}`
    : `M ${cx + sh - 1.5} ${sy + 3.5} Q ${cx + sh + outward} ${sy + 14} ${cx + sh - 0.5} ${sy + 25}`;
}

/** Arms — round strokes off each shoulder; gym reads via `armW`. */
function Arms({ g, color }: { g: BodyGeometry; color: string }): JSX.Element {
  const { headCx: cx, shoulderY: sy, shoulderHalf: sh, armW } = g;
  return (
    <g>
      <path d={armPathD(g, "left")} stroke={color} strokeWidth={armW} strokeLinecap="round" fill="none" />
      <path d={armPathD(g, "right")} stroke={color} strokeWidth={armW} strokeLinecap="round" fill="none" />
      <circle cx={cx - sh + 0.5} cy={sy + 25.5} r={armW * 0.58} fill={color} />
      <circle cx={cx + sh - 0.5} cy={sy + 25.5} r={armW * 0.58} fill={color} />
    </g>
  );
}

/** Modesty band every body wears under shirts — never a bare doll. */
function Bottoms({ g }: { g: BodyGeometry }): JSX.Element {
  const { headCx: cx, waistY: wy, hipHalf } = g;
  return (
    <rect
      x={cx - hipHalf - 0.6}
      y={wy - 1.5}
      width={hipHalf * 2 + 1.2}
      height={8}
      rx={3}
      fill={C.bottoms}
    />
  );
}

// ── humans ──────────────────────────────────────────────────────────────────

function HumanFace({ g }: { g: BodyGeometry }): JSX.Element {
  const { headCx: cx, headCy: cy } = g;
  return (
    <g>
      <circle cx={cx - 4.5} cy={cy - 0.5} r={1.35} fill={C.ink} />
      <circle cx={cx + 4.5} cy={cy - 0.5} r={1.35} fill={C.ink} />
      <path d={`M ${cx - 2.6} ${cy + 5.5} Q ${cx} ${cy + 7.2} ${cx + 2.6} ${cy + 5.5}`} stroke={C.ink} strokeWidth={1.1} strokeLinecap="round" fill="none" />
    </g>
  );
}

/** Human head: ears, skull, minimal face. Hair/beard/hat render as later layers. */
function HumanHead({ g, coat }: { g: BodyGeometry; coat: HumanCoat }): JSX.Element {
  const { headCx: cx, headCy: cy, headRx: rx, headRy: ry } = g;
  return (
    <g>
      <circle cx={cx - rx} cy={cy + 1.5} r={2.1} fill={coat.shade} {...OUTLINE} />
      <circle cx={cx + rx} cy={cy + 1.5} r={2.1} fill={coat.shade} {...OUTLINE} />
      <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill={coat.skin} {...OUTLINE} />
      <HumanFace g={g} />
    </g>
  );
}

export function HumanBody({ g, coat }: { g: BodyGeometry; coat: HumanCoat }): JSX.Element {
  const { headCx: cx, headCy: cy, headRy: ry, shoulderY: sy } = g;
  return (
    <g>
      {/* neck behind the head */}
      <path d={`M ${cx - 3.5} ${cy + ry - 3} L ${cx - 3.5} ${sy + 2} L ${cx + 3.5} ${sy + 2} L ${cx + 3.5} ${cy + ry - 3}`} fill={coat.shade} />
      <Legs g={g} color={coat.skin} />
      <Arms g={g} color={coat.skin} />
      <path d={torsoPath(g)} fill={coat.skin} {...OUTLINE} />
      <Bottoms g={g} />
      <HumanHead g={g} coat={coat} />
    </g>
  );
}

// ── species (upright humanoid stand-ins — two arms, species head) ─────────

function DogHead({ g, coat }: { g: BodyGeometry; coat: SpeciesCoat }): JSX.Element {
  const { headCx: cx, headCy: cy, headRx: rx, headRy: ry } = g;
  return (
    <g>
      {/* droopy ears behind the skull */}
      <path
        d={`M ${cx - rx + 1.5} ${cy - 10} Q ${cx - rx - 8} ${cy - 9} ${cx - rx - 5.5} ${cy + 5} Q ${cx - rx - 4} ${cy + 11.6} ${cx - rx + 3.5} ${cy + 8} Q ${cx - rx + 6} ${cy - 4} ${cx - rx + 1.5} ${cy - 10} Z`}
        fill={coat.shade}
        {...OUTLINE}
      />
      <path
        d={`M ${cx + rx - 1.5} ${cy - 10} Q ${cx + rx + 8} ${cy - 9} ${cx + rx + 5.5} ${cy + 5} Q ${cx + rx + 4} ${cy + 11.6} ${cx + rx - 3.5} ${cy + 8} Q ${cx + rx - 6} ${cy - 4} ${cx + rx - 1.5} ${cy - 10} Z`}
        fill={coat.shade}
        {...OUTLINE}
      />
      <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill={coat.fur} {...OUTLINE} />
      {/* muzzle */}
      <ellipse cx={cx} cy={cy + 7} rx={rx * 0.62} ry={ry * 0.42} fill={coat.muzzle} {...OUTLINE} />
      {/* nose */}
      <path
        d={`M ${cx - 2.6} ${cy + 4.6} Q ${cx} ${cy + 3.2} ${cx + 2.6} ${cy + 4.6} Q ${cx + 1.6} ${cy + 7} ${cx} ${cy + 7.4} Q ${cx - 1.6} ${cy + 7} ${cx - 2.6} ${cy + 4.6} Z`}
        fill={C.hatBand}
      />
      <circle cx={cx - 5.5} cy={cy - 2} r={1.4} fill={C.ink} />
      <circle cx={cx + 5.5} cy={cy - 2} r={1.4} fill={C.ink} />
      <path d={`M ${cx} ${cy + 7.4} Q ${cx} ${cy + 9.4} ${cx - 2.4} ${cy + 9.7}`} stroke={C.ink} strokeWidth={1} strokeLinecap="round" fill="none" />
    </g>
  );
}

function CatHead({ g, coat }: { g: BodyGeometry; coat: SpeciesCoat }): JSX.Element {
  const { headCx: cx, headCy: cy, headRx: rx, headRy: ry } = g;
  return (
    <g>
      {/* pointed ears behind the skull */}
      <path d={`M ${cx - rx + 2} ${cy - 8} L ${cx - rx - 2} ${cy - 19} L ${cx - 2.5} ${cy - 10} Z`} fill={coat.fur} {...OUTLINE} />
      <path d={`M ${cx + rx - 2} ${cy - 8} L ${cx + rx + 2} ${cy - 19} L ${cx + 2.5} ${cy - 10} Z`} fill={coat.fur} {...OUTLINE} />
      <path d={`M ${cx - rx + 3} ${cy - 9} L ${cx - rx - 0.5} ${cy - 16} L ${cx - 3.5} ${cy - 10} Z`} fill={coat.inner} />
      <path d={`M ${cx + rx - 3} ${cy - 9} L ${cx + rx + 0.5} ${cy - 16} L ${cx + 3.5} ${cy - 10} Z`} fill={coat.inner} />
      <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill={coat.fur} {...OUTLINE} />
      {/* almond eyes */}
      <ellipse cx={cx - 5} cy={cy - 1} rx={1.7} ry={2.2} fill={C.catEye} />
      <ellipse cx={cx + 5} cy={cy - 1} rx={1.7} ry={2.2} fill={C.catEye} />
      {/* nose + ω mouth + whiskers */}
      <path d={`M ${cx - 1.5} ${cy + 3} L ${cx + 1.5} ${cy + 3} L ${cx} ${cy + 4.6} Z`} fill={coat.inner} />
      <path
        d={`M ${cx - 2.6} ${cy + 5.4} Q ${cx - 1.3} ${cy + 6.8} ${cx} ${cy + 5.4} Q ${cx + 1.3} ${cy + 6.8} ${cx + 2.6} ${cy + 5.4}`}
        stroke={C.ink}
        strokeWidth={0.9}
        strokeLinecap="round"
        fill="none"
      />
      <g stroke={C.ink} strokeWidth={0.7} opacity={0.75}>
        <line x1={cx - rx + 0.5} y1={cy + 3.2} x2={cx - rx - 7} y2={cy + 2.2} />
        <line x1={cx - rx + 0.5} y1={cy + 5.2} x2={cx - rx - 7} y2={cy + 5.6} />
        <line x1={cx + rx - 0.5} y1={cy + 3.2} x2={cx + rx + 7} y2={cy + 2.2} />
        <line x1={cx + rx - 0.5} y1={cy + 5.2} x2={cx + rx + 7} y2={cy + 5.6} />
      </g>
    </g>
  );
}

function HorseHead({ g, coat }: { g: BodyGeometry; coat: SpeciesCoat }): JSX.Element {
  const { headCx: cx, headCy: cy, headRx: rx, headRy: ry } = g;
  return (
    <g>
      {/* mane behind the head, flowing to the shoulder */}
      <path
        d={`M ${cx + rx - 2} ${cy - 11} Q ${cx + rx + 11} ${cy - 2} ${cx + rx + 7} ${cy + ry + 14}`}
        stroke={C.mane}
        strokeWidth={7}
        strokeLinecap="round"
        fill="none"
      />
      {/* tall ears */}
      <path d={`M ${cx - rx + 5} ${cy - ry + 3.5} L ${cx - rx + 2} ${cy - ry - 9.5} L ${cx - 2} ${cy - ry + 1.5} Z`} fill={coat.fur} {...OUTLINE} />
      <path d={`M ${cx + rx - 5} ${cy - ry + 3.5} L ${cx + rx - 2} ${cy - ry - 9.5} L ${cx + 2} ${cy - ry + 1.5} Z`} fill={coat.fur} {...OUTLINE} />
      <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill={coat.fur} {...OUTLINE} />
      {/* forelock tuft */}
      <ellipse cx={cx} cy={cy - ry + 2.5} rx={4.2} ry={2.2} fill={C.mane} />
      {/* long muzzle */}
      <ellipse cx={cx} cy={cy + ry - 2.5} rx={rx * 0.66} ry={ry * 0.38} fill={coat.muzzle} {...OUTLINE} />
      <circle cx={cx - 3.2} cy={cy + ry - 2.5} r={0.95} fill={C.ink} opacity={0.7} />
      <circle cx={cx + 3.2} cy={cy + ry - 2.5} r={0.95} fill={C.ink} opacity={0.7} />
      <circle cx={cx - 4.4} cy={cy - 1.5} r={1.35} fill={C.ink} />
      <circle cx={cx + 4.4} cy={cy - 1.5} r={1.35} fill={C.ink} />
    </g>
  );
}

function SpeciesTail({ g, species, coat }: { g: BodyGeometry; species: "dog" | "cat" | "horse"; coat: SpeciesCoat }): JSX.Element {
  const { headCx: cx, waistY: wy, hipHalf: hip } = g;
  const x = cx + hip;
  if (species === "horse") {
    return (
      <path
        d={`M ${x} ${wy - 7} Q ${x + 12} ${wy - 1} ${x + 10.5} ${wy + 17}`}
        stroke={C.mane}
        strokeWidth={8}
        strokeLinecap="round"
        fill="none"
      />
    );
  }
  if (species === "cat") {
    return (
      <path
        d={`M ${x} ${wy - 6} Q ${x + 10} ${wy - 8} ${x + 8} ${wy + 3} Q ${x + 7} ${wy + 9} ${x + 11} ${wy + 12}`}
        stroke={coat.fur}
        strokeWidth={3.4}
        strokeLinecap="round"
        fill="none"
      />
    );
  }
  return (
    <g>
      <path
        d={`M ${x} ${wy - 5} Q ${x + 10} ${wy - 2} ${x + 8.5} ${wy + 11}`}
        stroke={coat.fur}
        strokeWidth={4.2}
        strokeLinecap="round"
        fill="none"
      />
      <circle cx={x + 8.5} cy={wy + 11} r={2.4} fill={coat.muzzle} />
    </g>
  );
}

export function SpeciesBody({
  g,
  species,
  coat,
}: {
  g: BodyGeometry;
  species: "dog" | "cat" | "horse";
  coat: SpeciesCoat;
}): JSX.Element {
  const { headCx: cx, headCy: cy, headRy: ry, shoulderY: sy, headRx: rx } = g;
  const head =
    species === "dog" ? (
      <DogHead g={g} coat={coat} />
    ) : species === "cat" ? (
      <CatHead g={g} coat={coat} />
    ) : (
      <HorseHead g={g} coat={coat} />
    );
  return (
    <g>
      <SpeciesTail g={g} species={species} coat={coat} />
      <path d={`M ${cx - 3.4} ${cy + ry - 3} L ${cx - 3.4} ${sy + 2} L ${cx + 3.4} ${sy + 2} L ${cx + 3.4} ${cy + ry - 3}`} fill={coat.shade} />
      <Legs g={g} color={coat.fur} />
      <Arms g={g} color={coat.fur} />
      <path d={torsoPath(g)} fill={coat.fur} {...OUTLINE} />
      <Bottoms g={g} />
      {species === "cat" ? null : (
        <circle cx={cx + (species === "horse" ? rx * 0.78 : rx * 0.7)} cy={cy + ry - 3.8} r={1.9} fill={coat.shade} opacity={0.85} />
      )}
      {head}
    </g>
  );
}

// ── neutral silhouette (null spec / unknown base) ─────────────────────────

/** Ghost bust — the empty-seat placeholder. No face, flat token grey. */
export function NeutralSilhouette(): JSX.Element {
  return (
    <g aria-hidden>
      <path d="M 46.5 30 L 46.5 44 L 53.5 44 L 53.5 30 Z" fill={C.silhouette} />
      <path
        d="M 36 56 C 36 46.5 42.5 42.5 50 42.5 C 57.5 42.5 64 46.5 64 56 C 64 64 62 72 60 78 L 40 78 C 38 72 36 64 36 56 Z"
        fill={C.silhouette}
      />
      <ellipse cx={50} cy={27} rx={12} ry={12.5} fill={C.silhouette} />
    </g>
  );
}
