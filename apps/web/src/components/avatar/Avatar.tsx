"use client";

/**
 * ============================================================================
 * AVATAR — the layered SVG paper-doll (owner 2026-11-23: "avatar really
 * wears that clothes — same to same"; STR/05 §2: token colors, no hex soup)
 * ============================================================================
 * viewBox 100×100, deterministic layers in a FIXED stack (STR/03 §2 order):
 *   base body → shirt → beard → hair → hat → glasses → frame
 * `preview` merges over `spec` for the live try-on in the shop/settings.
 * A null spec or an unknown base renders the neutral silhouette (the empty
 * seat); legacy animal/default base slugs bridge onto the closest canonical
 * body so existing specs never degrade to a blank.
 *
 * NO animation in here on purpose (anim ids are data, not visuals) — the
 * render is a pure function of its props so tests can snapshot-diff the
 * whole JSX tree.
 */
import type { JSX } from "react";
import type { AttachableSlot, AvatarBaseId, AvatarSpec } from "@/lib/wire";
import { AVATAR_BASE_IDS, DEFAULT_AVATAR_BASE } from "@/lib/wire";
import { AVATAR_PALETTE as C, BASE_GEOMETRY, PART_ADJUST, type BodyGeometry } from "./layout";
import { HumanBody, NeutralSilhouette, SpeciesBody, type HumanCoat, type SpeciesCoat } from "./parts/bodies";
import { renderPart, type PartSlot } from "./parts/wearables";

const HUMAN_COAT: HumanCoat = { skin: C.skin, shade: C.skinShade };

/** Canonical species fur coats — shared with AvatarThumb. */
export const SPECIES_COATS: Record<"dog" | "cat" | "horse", SpeciesCoat> = {
  dog: { fur: C.dogFur, shade: C.dogFurShade, inner: C.blush, muzzle: C.hairIvory },
  cat: { fur: C.catFur, shade: C.catFurShade, inner: C.catInnerEar, muzzle: C.clothWhite },
  horse: { fur: C.horseFur, shade: C.horseFurShade, inner: C.blush, muzzle: C.hairIvory },
};

/**
 * Pre-canonical-era base slugs → nearest real body (one render-time bridge;
 * the wire schema stays open so old specs never bounce). 'default' is the
 * users.avatarSpec default from before the 7 canonical bases existed.
 */
const LEGACY_BRIDGE: Record<string, { body: AvatarBaseId; coat?: SpeciesCoat }> = {
  default: { body: "human-male-thin" },
  fox: { body: "dog", coat: { fur: C.foxFur, shade: C.foxFurShade, inner: C.blush, muzzle: C.hairIvory } },
  wolf: { body: "dog", coat: { fur: C.wolfFur, shade: C.wolfFurShade, inner: C.catInnerEar, muzzle: C.hairIvory } },
  bear: { body: "dog", coat: { fur: C.bearFur, shade: C.horseFurShade, inner: C.catInnerEar, muzzle: C.hairIvory } },
  raccoon: { body: "cat", coat: { fur: C.catFur, shade: C.catFurShade, inner: C.catInnerEar, muzzle: C.clothWhite } },
  rabbit: { body: "cat", coat: { fur: C.hairIvory, shade: C.clothWhite, inner: C.catInnerEar, muzzle: C.clothWhite } },
  deer: { body: "horse", coat: { fur: C.feltTan, shade: C.horseFurShade, inner: C.blush, muzzle: C.hairIvory } },
};

interface BodyPlan {
  body: AvatarBaseId;
  species?: "dog" | "cat" | "horse";
  coat?: SpeciesCoat;
}

/** base slug → a drawable body plan; null = unknown (silhouette). */
export function resolveBodyPlan(base: string | undefined): BodyPlan | null {
  if (base && (AVATAR_BASE_IDS as readonly string[]).includes(base)) {
    const body = base as AvatarBaseId;
    return body.startsWith("human-") ? { body } : { body, species: body as "dog" | "cat" | "horse" };
  }
  const bridge = base ? LEGACY_BRIDGE[base] : undefined;
  if (!bridge) return null;
  if (bridge.body.startsWith("human-")) return { body: bridge.body };
  const species = bridge.body as "dog" | "cat" | "horse";
  return { body: bridge.body, species, ...(bridge.coat ? { coat: bridge.coat } : {}) };
}

function renderBaseLayer(plan: BodyPlan, g: BodyGeometry): JSX.Element {
  if (plan.body.startsWith("human-")) return <HumanBody g={g} coat={HUMAN_COAT} />;
  const species = plan.species ?? (plan.body as "dog" | "cat" | "horse");
  return <SpeciesBody g={g} species={species} coat={plan.coat ?? SPECIES_COATS[species]} />;
}

/** One wearable layer with its species anchor-nudge applied (PART_ADJUST). */
function partLayer(
  slot: PartSlot,
  id: string | undefined,
  g: BodyGeometry,
  base: AvatarBaseId,
  key: string,
): JSX.Element | null {
  const dy = PART_ADJUST[base]?.[slot as AttachableSlot]?.dy ?? 0;
  const art = renderPart(slot, id, g);
  if (!art) return null;
  return (
    <g key={key} transform={dy !== 0 ? `translate(0 ${dy})` : undefined}>
      {art}
    </g>
  );
}

export function Avatar({
  spec,
  size = 64,
  className,
  preview,
}: {
  /** Wire avatarSpec — see `AvatarSpecSchema` in @liars-game/shared. */
  spec: AvatarSpec | null;
  /** Square side in px (the doll scales from 32px seat chips to hero art). */
  size?: number;
  className?: string;
  /** Live try-on: merged OVER spec (explicit `undefined` clears a slot). */
  preview?: Partial<AvatarSpec>;
}): JSX.Element {
  // try-on merge: preview slots override spec (an explicit `undefined` clears
  // a slot); a missing base falls back to the canonical default body.
  const merged: AvatarSpec | null =
    spec || preview
      ? { ...spec, ...preview, base: spec?.base ?? preview?.base ?? DEFAULT_AVATAR_BASE }
      : null;
  const plan = resolveBodyPlan(merged?.base);

  if (!merged || !plan) {
    return (
      <svg
        viewBox="0 0 100 100"
        width={size}
        height={size}
        className={className}
        role="img"
        aria-label={merged ? `avatar ${merged.base}` : "empty seat"}
      >
        <NeutralSilhouette />
      </svg>
    );
  }

  const g = BASE_GEOMETRY[plan.body];
  const label = merged.base === "default" ? "human-male-thin" : merged.base;

  return (
    <svg
      viewBox="0 0 100 100"
      width={size}
      height={size}
      className={className}
      role="img"
      aria-label={`avatar ${label}${merged.hat ? ` wearing ${merged.hat}` : ""}`}
    >
      {renderBaseLayer(plan, g)}
      {partLayer("shirt", merged.shirt, g, plan.body, "shirt")}
      {partLayer("beard", merged.beard, g, plan.body, "beard")}
      {partLayer("hair", merged.hair, g, plan.body, "hair")}
      {partLayer("hat", merged.hat, g, plan.body, "hat")}
      {partLayer("glasses", merged.glasses, g, plan.body, "glasses")}
      {partLayer("frame", merged.frame, g, plan.body, "frame")}
    </svg>
  );
}
