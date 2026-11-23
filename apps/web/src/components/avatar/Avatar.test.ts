import { describe, expect, it } from "vitest";
import { mergePreviewSpec } from "@/components/avatar/Avatar";
import type { AvatarSpec } from "@/lib/wire";

/**
 * ============================================================================
 * mergePreviewSpec — the try-on merge law (settings/shop live try-on)
 * ============================================================================
 * T4 2026-11-23: `preview.base` OVERRIDES `spec.base` (a live base try-on
 * rides the same prop as wearables — no caller-side spec swapping), and a
 * missing base anywhere falls back to the canonical `human-male-thin`.
 * ============================================================================
 */

const SPEC: AvatarSpec = {
  base: "human-female-thin",
  hat: "hat:cowboy",
  shirt: "shirt:pinstripe",
};

describe("mergePreviewSpec", () => {
  it("preview.base overrides an already-equipped base (T4 regression)", () => {
    expect(mergePreviewSpec(SPEC, { base: "horse" })).toEqual({
      base: "horse",
      hat: "hat:cowboy",
      shirt: "shirt:pinstripe",
    });
  });

  it("base try-on works with no spec at all", () => {
    expect(mergePreviewSpec(null, { base: "human-male-gym" })).toEqual({ base: "human-male-gym" });
  });

  it("wearable preview merges onto the spec untouched elsewhere", () => {
    expect(mergePreviewSpec(SPEC, { hat: "hat:cap" })).toEqual({
      base: "human-female-thin",
      hat: "hat:cap",
      shirt: "shirt:pinstripe",
    });
  });

  it("no preview returns the spec unchanged", () => {
    expect(mergePreviewSpec(SPEC)).toEqual(SPEC);
  });

  it("both absent → null (the empty-seat silhouette)", () => {
    expect(mergePreviewSpec(null)).toBeNull();
  });

  it("a base-less try-on lands on the canonical default", () => {
    expect(mergePreviewSpec(null, { hat: "hat:cap" })).toEqual({ base: "human-male-thin", hat: "hat:cap" });
  });
});
