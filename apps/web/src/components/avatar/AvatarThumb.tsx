"use client";

/**
 * AvatarThumb — a standalone single-item card art for shop tiles, inventory
 * chips and admin previews: a muted neutral mannequin wearing JUST the item
 * (no base spec needed). `slot: "base"` renders the body itself (accepts a
 * bare slug or its `body:<slug>` catalog id).
 */
import type { JSX } from "react";
import { AVATAR_PALETTE as C, NEUTRAL_GEOMETRY } from "./layout";
import { HumanBody, NeutralSilhouette, SpeciesBody, type HumanCoat } from "./parts/bodies";
import { renderPart, type PartSlot } from "./parts/wearables";
import { resolveBodyPlan, SPECIES_COATS } from "./Avatar";

const MANNEQUIN_COAT: HumanCoat = { skin: C.placeholder, shade: C.placeholderShade };

function BodyThumb({ id, size }: { id: string; size: number }): JSX.Element {
  const plan = resolveBodyPlan(id.replace(/^body:/, ""));
  if (!plan) {
    return (
      <svg viewBox="0 0 100 100" width={size} height={size} role="img" aria-label="unknown body">
        <NeutralSilhouette />
      </svg>
    );
  }
  const label = `body ${plan.body}`;
  const coat = plan.coat ?? (plan.species ? SPECIES_COATS[plan.species] : undefined);
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} role="img" aria-label={label}>
      {plan.body.startsWith("human-") ? (
        <HumanBody g={NEUTRAL_GEOMETRY} coat={{ skin: C.skin, shade: C.skinShade }} />
      ) : (
        <SpeciesBody g={NEUTRAL_GEOMETRY} species={plan.species ?? (plan.body as "dog" | "cat" | "horse")} coat={coat ?? SPECIES_COATS.dog} />
      )}
    </svg>
  );
}

export function AvatarThumb({
  slot,
  id,
  size = 64,
  className,
}: {
  slot: PartSlot | "base";
  id: string;
  size?: number;
  className?: string;
}): JSX.Element {
  if (slot === "base") return <BodyThumb id={id} size={size} />;

  const g = NEUTRAL_GEOMETRY;
  const art = renderPart(slot, id, g);

  return (
    <svg
      viewBox="0 0 100 100"
      width={size}
      height={size}
      className={className}
      role="img"
      aria-label={`${slot} ${id}`}
    >
      <HumanBody g={g} coat={MANNEQUIN_COAT} />
      {art}
    </svg>
  );
}
