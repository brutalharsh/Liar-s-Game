/**
 * Faithful per-catalog-item art (owner: "avatar really wears that clothes —
 * same to same"). One entry per server seed item id (apps/server
 * scripts/seed-catalog.ts) that has a VISUAL body slot: hair 6 · beard 4 ·
 * hat 5 · shirt 6 · glasses 3 · frame 8. Anim / voicePack / theme are
 * non-visual and render nothing.
 *
 * Every part anchors itself against shared head/torso bands (layout.ts) so
 * it fits ALL 7 bases; species nudges come from PART_ADJUST at the Avatar
 * layer. Unknown ids never reach this file — wearables.tsx falls back to a
 * clean per-slot placeholder so admin-created future items can't break a
 * render. Legacy hyphen catalog ids (lib/mock/catalog) alias to their twins.
 */
import type { JSX } from "react";
import { AVATAR_PALETTE as C, type BodyGeometry } from "./layout";
import { armPathD, torsoPath } from "./parts/bodies";

export type PartArt = (g: BodyGeometry) => JSX.Element | null;

const OUT = { stroke: C.outline, strokeWidth: 1.4 } as const;

// ── hair ────────────────────────────────────────────────────────────────────

/** Crescent cap band hugging the skull — the shared base of most haircuts. */
function hairCap(g: BodyGeometry, thickness: number): string {
  const { headCx: cx, headCy: cy, headRx: rx, headRy: ry } = g;
  const crownIn = cy - ry + thickness + 3;
  return [
    `M ${cx - rx} ${cy - 2.5}`,
    `A ${rx} ${ry} 0 0 1 ${cx + rx} ${cy - 2.5}`,
    `L ${cx + rx - 0.5} ${cy - 4.2}`,
    `A ${rx - 0.6} ${ry - thickness} 0 0 0 ${cx - rx + 0.5} ${crownIn}`,
    "Z",
  ].join(" ");
}

function HairShort(g: BodyGeometry): JSX.Element {
  return <path d={hairCap(g, 1.4)} fill={C.hairDark} {...OUT} strokeWidth={1.2} />;
}

function HairBraids(g: BodyGeometry): JSX.Element {
  const { headCx: cx, headCy: cy, headRx: rx } = g;
  return (
    <g>
      <path d={hairCap(g, 2.6)} fill={C.hairGinger} {...OUT} strokeWidth={1.2} />
      {[cx - rx - 1.2, cx + rx + 1.2].map((x) => (
        <g key={x}>
          {[cy + 3, cy + 7.5, cy + 12].map((y, i) => (
            <ellipse key={y} cx={x} cy={y} rx={2.15 - i * 0.25} ry={2.6} fill={C.hairGinger} {...OUT} strokeWidth={1.1} />
          ))}
          <ellipse cx={x} cy={cy + 15.4} rx={1.7} ry={1.1} fill={C.brass} />
        </g>
      ))}
    </g>
  );
}

function HairAfro(g: BodyGeometry): JSX.Element {
  const { headCx: cx, headCy: cy, headRy: ry } = g;
  return (
    <g>
      <circle cx={cx} cy={cy - ry - 2.6} r={9.4} fill={C.hairBlack} {...OUT} strokeWidth={1.3} />
      <circle cx={cx - 7.4} cy={cy - ry + 2.4} r={3.1} fill={C.hairBlack} {...OUT} strokeWidth={1.2} />
      <circle cx={cx + 7.4} cy={cy - ry + 2.4} r={3.1} fill={C.hairBlack} {...OUT} strokeWidth={1.2} />
    </g>
  );
}

function HairManBun(g: BodyGeometry): JSX.Element {
  const { headCx: cx, headCy: cy, headRy: ry } = g;
  return (
    <g>
      <path d={hairCap(g, 1.8)} fill={C.hairBlack} {...OUT} strokeWidth={1.2} />
      <circle cx={cx + 4.2} cy={cy - ry - 2.4} r={3.4} fill={C.hairBlack} {...OUT} strokeWidth={1.3} />
      <path d={`M ${cx + 1.4} ${cy - ry - 4.6} Q ${cx + 4.2} ${cy - ry - 1} ${cx + 7} ${cy - ry - 3.4}`} stroke={C.hairIvory} strokeWidth={0.9} fill="none" opacity={0.55} />
    </g>
  );
}

function HairMohawk(g: BodyGeometry): JSX.Element {
  const { headCx: cx, headCy: cy, headRy: ry } = g;
  const top = cy - ry;
  return (
    <path
      d={[
        `M ${cx - 5.4} ${top + 2.2}`,
        `L ${cx - 4.6} ${top - 5.4}`,
        `L ${cx - 2.6} ${top - 3.6}`,
        `L ${cx - 1.6} ${top - 8.8}`,
        `L ${cx + 0.6} ${top - 4.2}`,
        `L ${cx + 2} ${top - 8}`,
        `L ${cx + 3.6} ${top - 3.2}`,
        `L ${cx + 4.8} ${top - 5.6}`,
        `L ${cx + 5.4} ${top + 2.2}`,
        "Z",
      ].join(" ")}
      fill={C.hairGinger}
      {...OUT}
      strokeWidth={1.2}
    />
  );
}

function HairPompadour(g: BodyGeometry): JSX.Element {
  const { headCx: cx, headCy: cy, headRy: ry } = g;
  const top = cy - ry;
  return (
    <g>
      <path d={hairCap(g, 1.6)} fill={C.hairDark} {...OUT} strokeWidth={1.2} />
      <path
        d={[
          `M ${cx - 7.2} ${top + 3.4}`,
          `C ${cx - 9.4} ${top - 4} ${cx - 2} ${top - 7.4} ${cx + 2.2} ${top - 5.6}`,
          `C ${cx + 6} ${top - 4} ${cx + 7.4} ${top - 1} ${cx + 6.8} ${top + 2.4}`,
          "Z",
        ].join(" ")}
        fill={C.hairDark}
        {...OUT}
        strokeWidth={1.3}
      />
      <path d={`M ${cx - 4.4} ${top + 0.4} Q ${cx - 1} ${top - 3.4} ${cx + 3.4} ${top - 2.6}`} stroke={C.metalShine} strokeWidth={0.8} fill="none" opacity={0.35} />
    </g>
  );
}

// ── beard (anchors under the mouth; chin = headCy + headRy) ──────────────────

function BeardNull(): null {
  return null;
}

function BeardGoatee(g: BodyGeometry): JSX.Element {
  const { headCx: cx, headCy: cy, headRy: ry } = g;
  return <ellipse cx={cx} cy={cy + ry - 2.4} rx={2.9} ry={2.7} fill={C.beardInk} {...OUT} strokeWidth={1.1} />;
}

function BeardMoustache(g: BodyGeometry): JSX.Element {
  const { headCx: cx, headCy: cy } = g;
  return (
    <g>
      <path d={`M ${cx - 4.4} ${cy + 4.4} Q ${cx} ${cy + 3} ${cx + 4.4} ${cy + 4.4}`} stroke={C.beardInk} strokeWidth={2.7} strokeLinecap="round" fill="none" />
      <path d={`M ${cx - 5.2} ${cy + 4.2} Q ${cx - 7.2} ${cy + 2.4} ${cx - 5.8} ${cy + 0.6}`} stroke={C.beardInk} strokeWidth={2.1} strokeLinecap="round" fill="none" />
      <path d={`M ${cx + 5.2} ${cy + 4.2} Q ${cx + 7.2} ${cy + 2.4} ${cx + 5.8} ${cy + 0.6}`} stroke={C.beardInk} strokeWidth={2.1} strokeLinecap="round" fill="none" />
      <circle cx={cx - 5.9} cy={cy + 0.5} r={1.25} fill={C.beardInk} />
      <circle cx={cx + 5.9} cy={cy + 0.5} r={1.25} fill={C.beardInk} />
    </g>
  );
}

function BeardFull(g: BodyGeometry): JSX.Element {
  const { headCx: cx, headCy: cy, headRx: rx, headRy: ry } = g;
  const chin = cy + ry;
  return (
    <g>
      <path
        d={[
          `M ${cx - rx} ${cy + 4.2}`,
          `A ${rx} ${ry} 0 0 0 ${cx + rx} ${cy + 4.2}`,
          `C ${cx + rx - 0.8} ${chin + 4.2} ${cx + rx - 3.6} ${chin + 6} ${cx} ${chin + 6.4}`,
          `C ${cx - rx + 3.6} ${chin + 6} ${cx - rx + 0.8} ${chin + 4.2} ${cx - rx} ${cy + 4.2}`,
          "Z",
        ].join(" ")}
        fill={C.beardInk}
        {...OUT}
        strokeWidth={1.2}
      />
      <path d={`M ${cx - 3.2} ${cy + 4.6} Q ${cx} ${cy + 3.4} ${cx + 3.2} ${cy + 4.6}`} stroke={C.beardInk} strokeWidth={2.4} strokeLinecap="round" fill="none" />
    </g>
  );
}

// ── hat (brim sits on the crown: headCy - headRy) ───────────────────────────

function brimY(g: BodyGeometry): number {
  return g.headCy - g.headRy + 0.9;
}

function HatCap(g: BodyGeometry): JSX.Element {
  const { headCx: cx } = g;
  const by = brimY(g);
  return (
    <g>
      <ellipse cx={cx - 6.4} cy={by + 1.1} rx={4.4} ry={1.5} fill={C.feltBrown} {...OUT} strokeWidth={1.1} />
      <path
        d={`M ${cx - 6} ${by + 1} Q ${cx - 6.6} ${by - 4.6} ${cx - 1.4} ${by - 5.6} Q ${cx + 5} ${by - 5} ${cx + 6} ${by + 0.6} Z`}
        fill={C.feltTan}
        {...OUT}
        strokeWidth={1.2}
      />
      <path d={`M ${cx - 6} ${by - 1.6} Q ${cx} ${by - 3.4} ${cx + 6} ${by - 1.8}`} stroke={C.feltBrown} strokeWidth={1} fill="none" />
    </g>
  );
}

function HatBowler(g: BodyGeometry): JSX.Element {
  const { headCx: cx } = g;
  const by = brimY(g);
  return (
    <g>
      <ellipse cx={cx} cy={by + 0.7} rx={8.4} ry={1.7} fill={C.hairBlack} {...OUT} strokeWidth={1.2} />
      <path d={`M ${cx - 5.9} ${by + 0.6} A 5.9 6.4 0 0 1 ${cx + 5.9} ${by + 0.6} Z`} fill={C.hairBlack} {...OUT} strokeWidth={1.2} />
      <path d={`M ${cx - 5.6} ${by - 2.4} Q ${cx} ${by - 4} ${cx + 5.6} ${by - 2.4}`} stroke={C.brass} strokeWidth={1.1} fill="none" opacity={0.9} />
    </g>
  );
}

function HatFedora(g: BodyGeometry): JSX.Element {
  const { headCx: cx } = g;
  const by = brimY(g);
  return (
    <g>
      <ellipse cx={cx} cy={by + 1} rx={9.6} ry={2} fill={C.feltBrown} {...OUT} strokeWidth={1.2} />
      <path
        d={`M ${cx - 6.2} ${by + 0.6} L ${cx - 3.2} ${by - 5.4} L ${cx - 1.2} ${by - 4} L ${cx + 0.9} ${by - 6} L ${cx + 6.2} ${by + 0.6} Z`}
        fill={C.feltBrown}
        {...OUT}
        strokeWidth={1.2}
      />
      <path d={`M ${cx - 6} ${by - 1.7} L ${cx + 6} ${by - 1.7}`} stroke={C.hatBand} strokeWidth={1.5} />
      <path d={`M ${cx - 1.3} ${by - 2} L ${cx + 0.4} ${by - 4.6}`} stroke={C.hatBand} strokeWidth={0.9} />
    </g>
  );
}

function HatCowboy(g: BodyGeometry): JSX.Element {
  const { headCx: cx } = g;
  const by = brimY(g);
  return (
    <g>
      <ellipse cx={cx} cy={by + 1.2} rx={11.6} ry={2.3} fill={C.feltBrown} {...OUT} strokeWidth={1.2} />
      <path d={`M ${cx - 10.8} ${by + 0.6} Q ${cx - 12.4} ${by - 1.8} ${cx - 11.2} ${by - 3.4}`} stroke={C.feltBrown} strokeWidth={1.6} strokeLinecap="round" fill="none" />
      <path d={`M ${cx + 10.8} ${by + 0.6} Q ${cx + 12.4} ${by - 1.8} ${cx + 11.2} ${by - 3.4}`} stroke={C.feltBrown} strokeWidth={1.6} strokeLinecap="round" fill="none" />
      <path
        d={`M ${cx - 5} ${by + 0.6} C ${cx - 5.4} ${by - 6.4} ${cx + 5.4} ${by - 6.4} ${cx + 5} ${by + 0.6} Z`}
        fill={C.feltBrown}
        {...OUT}
        strokeWidth={1.2}
      />
      <path d={`M ${cx - 4.6} ${by - 1.4} L ${cx + 4.6} ${by - 1.4}`} stroke={C.hatBand} strokeWidth={1.6} />
      <rect x={cx - 1.5} y={by - 2.4} width={3} height={3} rx={0.6} fill={C.brass} />
      <path d={`M ${cx - 1} ${by - 6.4} Q ${cx} ${by - 7.8} ${cx + 1} ${by - 6.4}`} stroke={C.feltBrown} strokeWidth={0.9} fill="none" />
    </g>
  );
}

function HatSombrero(g: BodyGeometry): JSX.Element {
  const { headCx: cx } = g;
  const by = brimY(g);
  return (
    <g>
      <path
        d={[
          `M ${cx - 14.6} ${by - 2.6}`,
          `Q ${cx - 15} ${by + 0.8} ${cx - 10.6} ${by + 2}`,
          `Q ${cx} ${by + 5.6} ${cx + 10.6} ${by + 2}`,
          `Q ${cx + 15} ${by + 0.8} ${cx + 14.6} ${by - 2.6}`,
          `Q ${cx + 12.4} ${by - 0.4} ${cx + 8.6} ${by + 0.9}`,
          `Q ${cx} ${by + 2.9} ${cx - 8.6} ${by + 0.9}`,
          `Q ${cx - 12.4} ${by - 0.4} ${cx - 14.6} ${by - 2.6}`,
          "Z",
        ].join(" ")}
        fill={C.feltTan}
        {...OUT}
        strokeWidth={1.2}
      />
      <path
        d={`M ${cx - 3.8} ${by + 0.4} L ${cx - 1.9} ${by - 8} Q ${cx} ${by - 9.4} ${cx + 1.9} ${by - 8} L ${cx + 3.8} ${by + 0.4} Z`}
        fill={C.feltTan}
        {...OUT}
        strokeWidth={1.2}
      />
      <circle cx={cx} cy={by - 9} r={1.4} fill={C.brass} />
      <g fill={C.hatBand}>
        {[-2.6, -1.2, 0, 1.2, 2.6].map((dx) => (
          <path key={dx} d={`M ${cx + dx - 0.7} ${by - 1.2} l 1.4 0 l -0.7 ${dx === 0 ? 2.2 : 1.4} Z`} />
        ))}
      </g>
    </g>
  );
}

function HatMortarboard(g: BodyGeometry): JSX.Element {
  const { headCx: cx } = g;
  const by = brimY(g);
  return (
    <g>
      <path d={`M ${cx - 4.6} ${by} L ${cx - 6.2} ${by - 3.4} L ${cx + 6.2} ${by - 3.4} L ${cx + 4.6} ${by} Z`} fill={C.clothNavy} {...OUT} strokeWidth={1.1} />
      <path d={`M ${cx - 10.5} ${by - 3.2} L ${cx} ${by - 8.2} L ${cx + 10.5} ${by - 3.2} L ${cx} ${by + 1.6} Z`} fill={C.clothNavy} {...OUT} strokeWidth={1.2} />
      <path d={`M ${cx} ${by + 1.4} L ${cx} ${by - 5.6}`} stroke={C.brass} strokeWidth={0.9} strokeDasharray="1.3 1.1" />
      <circle cx={cx} cy={by - 6.4} r={1.2} fill={C.brass} />
    </g>
  );
}

// ── shirt (redraws the torso + sleeves over the body) ────────────────────────

function Sleeves(g: BodyGeometry, color: string, full: boolean): JSX.Element {
  const w = g.armW + 0.9;
  const left = full ? armPathD(g, "left") : cutSleeve(armPathD(g, "left"));
  const right = full ? armPathD(g, "right") : cutSleeve(armPathD(g, "right"));
  return (
    <g>
      <path d={left} stroke={color} strokeWidth={w} strokeLinecap="round" fill="none" />
      <path d={right} stroke={color} strokeWidth={w} strokeLinecap="round" fill="none" />
    </g>
  );
}

/** Trim a sleeve stroke to the upper arm (short-sleeve cut at the elbow). */
function cutSleeve(d: string): string {
  const m = /M ([\d.]+) ([\d.]+)/.exec(d);
  const q = /Q ([\d.]+) ([\d.]+)/.exec(d);
  if (!m || !q) return d;
  const midX = (Number(m[1]) + Number(q[1])) / 2;
  const midY = (Number(m[2]) + Number(q[3])) / 2;
  return `M ${m[1]} ${m[2]} L ${midX} ${midY + 4}`;
}

function CollarV(g: BodyGeometry, color: string): JSX.Element {
  const { headCx: cx, shoulderY: sy } = g;
  return (
    <path d={`M ${cx - 3.6} ${sy + 1} L ${cx} ${sy + 6.2} L ${cx + 3.6} ${sy + 1}`} stroke={color} strokeWidth={1.3} strokeLinecap="round" fill="none" />
  );
}

function Buttons(g: BodyGeometry, count: number): JSX.Element {
  const { headCx: cx, headRy: ry, shoulderY: sy } = g;
  return (
    <g fill={C.metalShine}>
      {Array.from({ length: count }, (_, i) => (
        <circle key={i} cx={cx} cy={sy + 4 + (i + 0.5) * (ry / 1.8)} r={0.85} opacity={0.85} />
      ))}
    </g>
  );
}

function ShirtWhite(g: BodyGeometry): JSX.Element {
  return (
    <g>
      {Sleeves(g, C.clothWhite, false)}
      <path d={torsoPath(g)} fill={C.clothWhite} {...OUT} />
      {CollarV(g, C.brassDeep)}
      {Buttons(g, 4)}
    </g>
  );
}

function ShirtRed(g: BodyGeometry): JSX.Element {
  const { headCx: cx, shoulderY: sy } = g;
  return (
    <g>
      {Sleeves(g, C.clothRed, true)}
      <path d={torsoPath(g)} fill={C.clothRed} {...OUT} />
      {CollarV(g, C.clothWhite)}
      <path d={`M ${cx} ${sy + 5.6} l -2 3 l 2 4 l 2 -4 Z`} fill={C.metalShine} opacity={0.9} />
      <path d={`M ${cx - 1.9} ${sy + 7.4} Q ${cx - 5} ${sy + 12} ${cx - 5.8} ${sy + 15}`} stroke={C.hairBlack} strokeWidth={0.8} fill="none" />
      <path d={`M ${cx + 1.9} ${sy + 7.4} Q ${cx + 5} ${sy + 12} ${cx + 5.8} ${sy + 15}`} stroke={C.hairBlack} strokeWidth={0.8} fill="none" />
    </g>
  );
}

function ShirtPoncho(g: BodyGeometry): JSX.Element {
  const { headCx: cx, shoulderY: sy, shoulderHalf: sh } = g;
  const wide = sh + 5.5;
  return (
    <g>
      <path
        d={`M ${cx} ${sy - 2.2} L ${cx - wide} ${sy + 27} L ${cx + wide} ${sy + 27} Z`}
        fill={C.feltTan}
        {...OUT}
        strokeWidth={1.3}
      />
      <path d={`M ${cx} ${sy - 2.2} L ${cx - wide * 0.62} ${sy + 17} L ${cx + wide * 0.62} ${sy + 17} Z`} fill={C.clothRed} opacity={0.9} />
      <path d={`M ${cx - wide * 0.78} ${sy + 17} L ${cx + wide * 0.78} ${sy + 17} L ${cx + wide * 0.905} ${sy + 21.5} L ${cx - wide * 0.905} ${sy + 21.5} Z`} fill={C.clothNavy} opacity={0.85} />
      <g stroke={C.feltTan} strokeWidth={1.1} strokeLinecap="round">
        {[-wide + 2, -wide / 2, 0, wide / 2, wide - 2].map((dx) => (
          <line key={dx} x1={cx + dx} y1={sy + 27} x2={cx + dx} y2={sy + 30} />
        ))}
      </g>
      <ellipse cx={cx} cy={sy - 1} rx={3.4} ry={1.5} fill={C.clothNavy} {...OUT} strokeWidth={1} />
    </g>
  );
}

function ShirtVest(g: BodyGeometry): JSX.Element {
  const { headCx: cx, shoulderY: sy, shoulderHalf: sh, waistY: wy } = g;
  return (
    <g>
      <path
        d={`M ${cx - sh + 0.8} ${sy + 0.8} L ${cx - 4.4} ${sy + 2} L ${cx - 4.9} ${wy + 2.6} L ${cx - sh + 1.6} ${wy + 1.2} Z`}
        fill={C.leather}
        {...OUT}
        strokeWidth={1.2}
      />
      <path
        d={`M ${cx + sh - 0.8} ${sy + 0.8} L ${cx + 4.4} ${sy + 2} L ${cx + 4.9} ${wy + 2.6} L ${cx + sh - 1.6} ${wy + 1.2} Z`}
        fill={C.leather}
        {...OUT}
        strokeWidth={1.2}
      />
      <path d={`M ${cx - 4.4} ${sy + 2} L ${cx - 4.9} ${wy + 2.6}`} stroke={C.leatherShade} strokeWidth={1.2} />
      <path d={`M ${cx + 4.4} ${sy + 2} L ${cx + 4.9} ${wy + 2.6}`} stroke={C.leatherShade} strokeWidth={1.2} />
      {Buttons(g, 1)}
    </g>
  );
}

function ShirtWaistcoat(g: BodyGeometry): JSX.Element {
  const { headCx: cx, shoulderY: sy, waistY: wy } = g;
  return (
    <g>
      {Sleeves(g, C.clothNavy, true)}
      <path d={torsoPath(g)} fill={C.clothNavy} {...OUT} />
      <path d={`M ${cx - 4.2} ${sy + 1.2} L ${cx} ${sy + 7} L ${cx + 4.2} ${sy + 1.2} L ${cx + 1.6} ${wy + 1} L ${cx - 1.6} ${wy + 1} Z`} fill={C.feltBrown} {...OUT} strokeWidth={1} />
      <path d={`M ${cx + 5.4} ${sy + 14} l 3.4 -1 l 0.4 2.8 Z`} fill={C.clothWhite} />
      <path d={`M ${cx - 4.6} ${sy + 16} Q ${cx} ${sy + 18.4} ${cx + 4.2} ${sy + 16.6}`} stroke={C.brass} strokeWidth={1} strokeDasharray="1.6 1.6" fill="none" />
    </g>
  );
}

function ShirtPinstripe(g: BodyGeometry): JSX.Element {
  const { headCx: cx, shoulderY: sy, shoulderHalf: sh, waistY: wy } = g;
  const rows = [-sh + 3, -sh * 0.45, 0, sh * 0.45, sh - 3];
  return (
    <g>
      {Sleeves(g, C.clothNavy, true)}
      <path d={torsoPath(g)} fill={C.clothNavy} {...OUT} />
      <g stroke={C.metalShine} strokeWidth={0.55} opacity={0.7}>
        {rows.map((dx) => (
          <line key={dx} x1={cx + dx} y1={sy + 3} x2={cx + dx * 0.72} y2={wy + 3} />
        ))}
      </g>
      {CollarV(g, C.clothWhite)}
      <path d={`M ${cx - 5.4} ${wy + 2.4} L ${cx + 5.4} ${wy + 2.4}`} stroke={C.clothWhite} strokeWidth={1.1} />
      <path d={`M ${cx - 1.1} ${sy + 5.2} l -2.2 1.2 l 2.2 1.2 Z`} fill={C.clothRed} />
      <path d={`M ${cx - 0.9} ${sy + 7.6} L ${cx} ${sy + 15.5} L ${cx + 0.9} ${sy + 7.6} Z`} fill={C.clothRed} />
    </g>
  );
}

// ── glasses (anchor across the eyes at headCy) ───────────────────────────────

function temples(g: BodyGeometry, inner: number): JSX.Element {
  const { headCx: cx, headCy: cy, headRx: rx } = g;
  return (
    <g stroke={C.ink} strokeWidth={1} strokeLinecap="round">
      <line x1={cx - inner} y1={cy} x2={cx - rx + 0.4} y2={cy + 1.1} />
      <line x1={cx + inner} y1={cy} x2={cx + rx - 0.4} y2={cy + 1.1} />
    </g>
  );
}

function GlassesRound(g: BodyGeometry): JSX.Element {
  const { headCx: cx, headCy: cy } = g;
  return (
    <g>
      {temples(g, 8.2)}
      <circle cx={cx - 4.5} cy={cy} r={3.7} fill={C.glassTint} fillOpacity={0.55} stroke={C.ink} strokeWidth={1.2} />
      <circle cx={cx + 4.5} cy={cy} r={3.7} fill={C.glassTint} fillOpacity={0.55} stroke={C.ink} strokeWidth={1.2} />
      <path d={`M ${cx - 0.8} ${cy} L ${cx + 0.8} ${cy}`} stroke={C.ink} strokeWidth={1.2} strokeLinecap="round" />
    </g>
  );
}

function GlassesAviators(g: BodyGeometry): JSX.Element {
  const { headCx: cx, headCy: cy } = g;
  const lens = (ex: number): string =>
    [
      `M ${ex - 3.7} ${cy - 2.2}`,
      `Q ${ex} ${cy - 3.2} ${ex + 3.7} ${cy - 2.2}`,
      `Q ${ex + 3.9} ${cy + 1.6} ${ex + 2.2} ${cy + 3.6}`,
      `Q ${ex} ${cy + 4.5} ${ex - 2.2} ${cy + 3.6}`,
      `Q ${ex - 3.9} ${cy + 1.6} ${ex - 3.7} ${cy - 2.2}`,
      "Z",
    ].join(" ");
  return (
    <g>
      {temples(g, 8.4)}
      <path d={lens(cx - 4.6)} fill={C.glassTint} fillOpacity={0.5} stroke={C.brass} strokeWidth={1.3} />
      <path d={lens(cx + 4.6)} fill={C.glassTint} fillOpacity={0.5} stroke={C.brass} strokeWidth={1.3} />
      <path d={`M ${cx - 0.9} ${cy - 2} L ${cx + 0.9} ${cy - 2}`} stroke={C.brass} strokeWidth={1.4} />
      <path d={`M ${cx - 5.4} ${cy - 2.6} L ${cx + 5.4} ${cy - 2.6}`} stroke={C.brass} strokeWidth={0.9} opacity={0.8} />
    </g>
  );
}

function GlassesMonocle(g: BodyGeometry): JSX.Element {
  const { headCx: cx, headCy: cy, waistY: wy } = g;
  const ex = cx + 4.4;
  return (
    <g>
      <circle cx={ex} cy={cy} r={3.9} fill={C.glassTint} fillOpacity={0.35} stroke={C.brass} strokeWidth={1.5} />
      <path d={`M ${cx - 2.6} ${cy - 1.4} Q ${cx} ${cy - 3} ${cx + 1} ${cy - 2.2}`} stroke={C.ink} strokeWidth={0.9} fill="none" />
      <path d={`M ${ex + 2.4} ${cy + 3.1} Q ${ex + 6.4} ${cy + 12} ${ex + 2} ${wy - 2}`} stroke={C.brassDeep} strokeWidth={0.8} strokeDasharray="1.4 1.1" fill="none" />
    </g>
  );
}

// ── frame (the level ring around the whole 100×100 portrait) ─────────────────

function ring(color: string, width: number, radius = 48.4): JSX.Element {
  return <circle cx={50} cy={50} r={radius} fill="none" stroke={color} strokeWidth={width} />;
}

function studs(color: string, radius = 48.4): JSX.Element {
  return (
    <g fill={color}>
      {[[50, 50 - radius], [50 + radius, 50], [50, 50 + radius], [50 - radius, 50]].map(([x, y]) => (
        <rect key={`${x}:${y}`} x={x - 1.2} y={y - 1.2} width={2.4} height={2.4} transform={`rotate(45 ${x} ${y})`} />
      ))}
    </g>
  );
}

function FramePlain(): JSX.Element {
  return ring(C.ivory, 1.6, 48.2);
}

function FrameWooden(): JSX.Element {
  return ring(C.wood, 3.2);
}

function FrameBrass(): JSX.Element {
  return (
    <g>
      {ring(C.brass, 3)}
      <path d="M 14.5 36 A 48.8 48.8 0 0 1 32 7.5" stroke={C.metalShine} strokeWidth={1} fill="none" opacity={0.6} />
    </g>
  );
}

function FrameNeon(): JSX.Element {
  return (
    <g>
      {ring(C.neonCyan, 1.2, 49.2)}
      {ring(C.neonPink, 2.2, 46.8)}
    </g>
  );
}

function FramePrestige(color: "prestigeBronze" | "prestigeSilver" | "prestigeGold" | "prestigeDiamond"): JSX.Element {
  return (
    <g>
      {ring(C[color], 3.4)}
      {studs(C[color], 48.4)}
      {color === "prestigeGold" || color === "prestigeDiamond" ? (
        <path d="M 50 1.6 l 1.6 2.8 l -3.2 0 Z" fill={C.metalShine} opacity={0.85} />
      ) : null}
    </g>
  );
}

// ── registry (server seed ids + legacy hyphen-catalog alias twins) ───────────

export const PART_BY_ID: Record<string, PartArt> = {
  // hair
  "hair:short": HairShort,
  "hair:braids": HairBraids,
  "hair:afro": HairAfro,
  "hair:man-bun": HairManBun,
  "hair:mohawk": HairMohawk,
  "hair:pompadour": HairPompadour,
  // beard
  "beard:clean-shaven": BeardNull,
  "beard:goatee": BeardGoatee,
  "beard:moustache": BeardMoustache,
  "beard:full-beard": BeardFull,
  // hat
  "hat:cap": HatCap,
  "hat:bowler": HatBowler,
  "hat:fedora": HatFedora,
  "hat:cowboy": HatCowboy,
  "hat:sombrero": HatSombrero,
  // shirt
  "shirt:white": ShirtWhite,
  "shirt:red": ShirtRed,
  "shirt:poncho": ShirtPoncho,
  "shirt:vest": ShirtVest,
  "shirt:waistcoat": ShirtWaistcoat,
  "shirt:pinstripe": ShirtPinstripe,
  // glasses
  "glasses:round": GlassesRound,
  "glasses:aviators": GlassesAviators,
  "glasses:monocle": GlassesMonocle,
  // frame
  "frame:plain": FramePlain,
  "frame:wooden": FrameWooden,
  "frame:brass": FrameBrass,
  "frame:neon": FrameNeon,
  "frame:prestige-bronze": () => FramePrestige("prestigeBronze"),
  "frame:prestige-silver": () => FramePrestige("prestigeSilver"),
  "frame:prestige-gold": () => FramePrestige("prestigeGold"),
  "frame:prestige-diamond": () => FramePrestige("prestigeDiamond"),

  // legacy lib/mock/catalog hyphen ids → their visual twins
  "hair-pompadour": HairPompadour,
  "hair-bleach": HairShort,
  "hair-ginger": HairPompadour,
  "hair-brunette": HairShort,
  "hair-mullet": HairBraids,
  "hair-silver": HairManBun,
  "beard-incognito": BeardFull,
  "beard-dock": BeardFull,
  "beard-stubble": BeardGoatee,
  "beard-longgrey": BeardFull,
  "hat-stetson": HatCowboy,
  "hat-bowler": HatBowler,
  "hat-newsboy": HatCap,
  "hat-feather": HatFedora,
  "hat-professor": HatMortarboard,
  "shirt-vest": ShirtVest,
  "shirt-stringtie": ShirtWhite,
  "shirt-denim": ShirtWaistcoat,
  "shirt-cardsharp": ShirtPinstripe,
  "shirt-rouge": ShirtRed,
  "shirt-hi-vis": ShirtVest,
  "glasses-shades": GlassesRound,
  "glasses-goggles": GlassesAviators,
  "glasses-monocle": GlassesMonocle,
  "frame-plain": FramePlain,
  "frame-brass": FrameBrass,
  "frame-mahogany": FrameWooden,
  "frame-ivory": FramePlain,
  "frame-vortex": FrameNeon,
};
