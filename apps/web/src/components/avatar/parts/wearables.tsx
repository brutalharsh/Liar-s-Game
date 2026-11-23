/**
 * Slot layer — resolves a spec slot + item id onto a body's geometry.
 *
 * A known catalog id renders its faithful art (catalog-parts); an UNKNOWN
 * id (admin-created future items, foreign catalogs) falls to a clean generic
 * placeholder for the slot so no spec can ever break a render. Species
 * anchor nudges (PART_ADJUST) are applied by the Avatar layer.
 */
import type { JSX } from "react";
import type { AttachableSlot } from "@/lib/wire";
import { AVATAR_PALETTE as C, type BodyGeometry } from "../layout";
import { PART_BY_ID } from "../catalog-parts";
import { torsoPath } from "./bodies";

/** Every visual slot the paper-doll stacks (frame rides last). */
export type PartSlot = AttachableSlot | "frame";

// ── clean generic placeholders (unknown ids — never a broken render) ────────

function PlaceholderHair(g: BodyGeometry): JSX.Element {
  const { headCx: cx, headCy: cy, headRx: rx, headRy: ry } = g;
  return (
    <path
      d={[
        `M ${cx - rx} ${cy - 2.5}`,
        `A ${rx} ${ry} 0 0 1 ${cx + rx} ${cy - 2.5}`,
        `L ${cx + rx - 0.5} ${cy - 4}`,
        `A ${rx - 0.6} ${ry - 2} 0 0 0 ${cx - rx + 0.5} ${cy - ry + 4.5}`,
        "Z",
      ].join(" ")}
      fill={C.placeholder}
      stroke={C.outline}
      strokeWidth={1.1}
    />
  );
}

function PlaceholderBeard(g: BodyGeometry): JSX.Element {
  const { headCx: cx, headCy: cy, headRy: ry } = g;
  return <ellipse cx={cx} cy={cy + ry - 2.2} rx={3.4} ry={3.1} fill={C.placeholder} stroke={C.outline} strokeWidth={1.1} />;
}

function PlaceholderHat(g: BodyGeometry): JSX.Element {
  const { headCx: cx, headCy: cy, headRy: ry } = g;
  const by = cy - ry + 1.2;
  return (
    <g>
      <ellipse cx={cx} cy={by + 0.9} rx={8} ry={1.6} fill={C.placeholder} stroke={C.outline} strokeWidth={1.1} />
      <path d={`M ${cx - 5.6} ${by + 0.6} A 5.6 5.2 0 0 1 ${cx + 5.6} ${by + 0.6} Z`} fill={C.placeholder} stroke={C.outline} strokeWidth={1.1} />
      <path d={`M ${cx - 5.2} ${by - 1.4} Q ${cx} ${by - 2.8} ${cx + 5.2} ${by - 1.4}`} stroke={C.placeholderShade} strokeWidth={1.2} fill="none" />
    </g>
  );
}

function PlaceholderShirt(g: BodyGeometry): JSX.Element {
  const { headCx: cx, shoulderY: sy } = g;
  return (
    <g>
      <path d={torsoPath(g)} fill={C.placeholder} stroke={C.outline} strokeWidth={1.2} />
      <path d={`M ${cx - 3.4} ${sy + 1} L ${cx} ${sy + 6} L ${cx + 3.4} ${sy + 1}`} stroke={C.placeholderShade} strokeWidth={1.3} strokeLinecap="round" fill="none" />
      <circle cx={cx} cy={sy + 9} r={0.9} fill={C.clothWhite} opacity={0.75} />
    </g>
  );
}

function PlaceholderGlasses(g: BodyGeometry): JSX.Element {
  const { headCx: cx, headCy: cy } = g;
  return (
    <g fill="none" stroke={C.placeholder} strokeWidth={1.3}>
      <rect x={cx - 8} y={cy - 2.4} width={7} height={4.6} rx={2.2} />
      <rect x={cx + 1} y={cy - 2.4} width={7} height={4.6} rx={2.2} />
      <path d={`M ${cx - 1} ${cy - 0.6} L ${cx + 1} ${cy - 0.6}`} strokeLinecap="round" />
    </g>
  );
}

function PlaceholderFrame(): JSX.Element {
  return <circle cx={50} cy={50} r={48.3} fill="none" stroke={C.placeholder} strokeWidth={1.5} />;
}

const PLACEHOLDERS: Record<PartSlot, (g: BodyGeometry) => JSX.Element | null> = {
  hair: PlaceholderHair,
  beard: PlaceholderBeard,
  hat: PlaceholderHat,
  shirt: PlaceholderShirt,
  glasses: PlaceholderGlasses,
  frame: () => PlaceholderFrame(),
};

/** Resolve one slot's id → part art, or the slot's clean placeholder. */
export function renderPart(slot: PartSlot, id: string | undefined, g: BodyGeometry): JSX.Element | null {
  if (!id) return null;
  const art = PART_BY_ID[id];
  if (art) return art(g);
  return PLACEHOLDERS[slot](g);
}
