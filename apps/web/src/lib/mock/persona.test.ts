import { beforeEach, describe, expect, it } from "vitest";
import {
  FREE_BASES,
  mergePersonaSpec,
  mockPersona,
  planEquip,
  resetViewerPersona,
  viewerNicknameSnapshot,
  viewerSpecSnapshot,
} from "@/lib/mock/persona";
import { catalogItemKey, ownsCatalogItem, type AdminAvatarSpec, type UserEntitlement } from "@/lib/api";

/**
 * ============================================================================
 * MOCK PERSONA — the frozen T3 equip/nickname contract, mirrored branch-for-
 * branch (apps/server/src/routes/me.ts). Pure planEquip cases run free; the
 * async mockPersona cases exercise the in-memory persistence the settings
 * dashboard rides (spec/nickname survive within the session).
 * ============================================================================
 */

const OWNED = (keys: readonly string[]) => (key: string) => keys.includes(key);

const OWNED_EVERYTHING = () => true;
const OWNED_NOTHING = () => false;

const BASELINE: AdminAvatarSpec = {
  base: "human-female-thin",
  hair: "hair:braids",
  hat: "hat:cowboy",
  shirt: "shirt:red",
  glasses: "glasses:round",
  frame: "frame:brass",
};

describe("planEquip — pure contract mirror", () => {
  it("equips an owned wearable: flat one-slot merge, other keys ride through", () => {
    const plan = planEquip("hat", "hat:cap", BASELINE, OWNED_EVERYTHING);
    expect(plan.ok).toBe(true);
    if (plan.ok) {
      expect(plan.spec.hat).toBe("hat:cap");
      expect(plan.spec.hair).toBe("hair:braids");
      expect(plan.spec.shirt).toBe("shirt:red");
      expect(plan.spec.base).toBe("human-female-thin");
    }
  });

  it("itemId null unequips the slot and never leaks `undefined` keys", () => {
    const plan = planEquip("glasses", null, BASELINE, OWNED_NOTHING);
    expect(plan.ok).toBe(true);
    if (plan.ok) {
      expect(plan.spec.glasses).toBeUndefined();
      expect("glasses" in plan.spec).toBe(false);
      expect(plan.spec.hat).toBe("hat:cowboy");
    }
  });

  it("rejects unowned wearables with EQUIPMENT_NOT_OWNED (free is not owned)", () => {
    const plan = planEquip("hair", "hair:mohawk", BASELINE, OWNED_NOTHING);
    expect(plan).toEqual({ ok: false, code: "EQUIPMENT_NOT_OWNED" });
  });

  it("rejects wrong-slot ids with ITEM_SLOT_MISMATCH", () => {
    const plan = planEquip("hat", "shirt:white", BASELINE, OWNED_EVERYTHING);
    expect(plan).toEqual({ ok: false, code: "ITEM_SLOT_MISMATCH" });
  });

  it("rejects unknown ids with ITEM_NOT_FOUND", () => {
    expect(planEquip("hat", "hat:moon-crater", BASELINE, OWNED_EVERYTHING)).toEqual({
      ok: false,
      code: "ITEM_NOT_FOUND",
    });
  });

  it("rejects non-attachable slots (frame) with BAD_REQUEST per the frozen enum", () => {
    expect(planEquip("frame", "frame:brass", BASELINE, OWNED_EVERYTHING)).toEqual({
      ok: false,
      code: "BAD_REQUEST",
    });
    expect(planEquip("voicePack", "voicePack:villain", BASELINE, OWNED_EVERYTHING)).toEqual({
      ok: false,
      code: "BAD_REQUEST",
    });
  });

  it("base: thin humans are free for everyone, others gate on the body:* entitlement", () => {
    expect(FREE_BASES).toEqual(["human-male-thin", "human-female-thin"]);
    expect(planEquip("base", "human-male-thin", BASELINE, OWNED_NOTHING).ok).toBe(true);
    expect(planEquip("base", "human-female-gym", BASELINE, OWNED_NOTHING)).toEqual({
      ok: false,
      code: "EQUIPMENT_NOT_OWNED",
    });
    expect(planEquip("base", "horse", BASELINE, OWNED(["horse"])).ok).toBe(true);
  });

  it("base: null is BASE_REQUIRED, unknown slugs are INVALID_BASE", () => {
    expect(planEquip("base", null, BASELINE, OWNED_EVERYTHING)).toEqual({
      ok: false,
      code: "BASE_REQUIRED",
    });
    expect(planEquip("base", "human-male-legendary", BASELINE, OWNED_EVERYTHING)).toEqual({
      ok: false,
      code: "INVALID_BASE",
    });
  });

  it("body catalog ids never attach to wearable slots", () => {
    expect(planEquip("hat", "body:dog", BASELINE, OWNED_EVERYTHING)).toEqual({
      ok: false,
      code: "ITEM_SLOT_MISMATCH",
    });
  });
});

describe("mergePersonaSpec — merge law", () => {
  it("missing spec merges onto the canonical default base", () => {
    const spec = mergePersonaSpec(null, "hat", "hat:cap");
    expect(spec).toEqual({ base: "human-male-thin", hat: "hat:cap" });
  });
});

describe("catalogItemKey / ownsCatalogItem — both catalog id generations", () => {
  const list: UserEntitlement[] = [
    { kind: "item", key: "bowler" },
    { kind: "item", key: "hat-old-hyphen-style" },
    { kind: "item", key: "dog" },
  ];
  it("colon ids fold to the slug after the first ':'", () => {
    expect(catalogItemKey("hat:bowler")).toBe("bowler");
    expect(catalogItemKey("body:dog")).toBe("dog");
    expect(ownsCatalogItem(list, "hat:bowler")).toBe(true);
    expect(ownsCatalogItem(list, "body:dog")).toBe(true);
  });
  it("colon-less ids (legacy hyphen catalog) stay whole", () => {
    expect(catalogItemKey("hat-old-hyphen-style")).toBe("hat-old-hyphen-style");
    expect(ownsCatalogItem(list, "hat-old-hyphen-style")).toBe(true);
    expect(ownsCatalogItem(list, "hat:cap")).toBe(false);
  });
});

describe("mockPersona — in-memory session mutations", () => {
  beforeEach(() => {
    resetViewerPersona();
  });

  it("equip lands the piece on the persona's spec (persists within the session)", async () => {
    const ack = await mockPersona.equip("hat", "hat:cap");
    expect(ack.spec.hat).toBe("hat:cap");
    expect(viewerSpecSnapshot().hat).toBe("hat:cap");
    const again = await mockPersona.equip("hat", null);
    expect(again.spec.hat).toBeUndefined();
    expect("hat" in viewerSpecSnapshot()).toBe(false);
  });

  it("equip of an unowned piece throws the contract code and changes nothing", async () => {
    const before = viewerSpecSnapshot();
    await expect(mockPersona.equip("base", "horse")).rejects.toMatchObject({
      error: "EQUIPMENT_NOT_OWNED",
      status: 403,
    });
    expect(viewerSpecSnapshot()).toEqual(before);
  });

  it("rename persists the sanitized nickname; blocklist + length answer the contract codes", async () => {
    const ack = await mockPersona.updateProfile("  mac   MAVERICK ");
    expect(ack.nickname).toBe("mac MAVERICK");
    expect(viewerNicknameSnapshot()).toBe("mac MAVERICK");

    await expect(mockPersona.updateProfile("hellо hitler")).rejects.toMatchObject({
      error: "NICKNAME_REJECTED",
      status: 422,
    });
    // Cyrillic і folds to 'i' — the obfuscated slur still trips the filter
    await expect(mockPersona.updateProfile("shіt")).rejects.toMatchObject({
      error: "NICKNAME_REJECTED",
      status: 422,
    });
    await expect(mockPersona.updateProfile("x".repeat(19))).rejects.toMatchObject({
      error: "BAD_REQUEST",
      status: 400,
    });
    expect(viewerNicknameSnapshot()).toBe("mac MAVERICK");
  });

  it("entitlements serve the rich persona: items across slots, themes, titles", async () => {
    const { entitlements } = await mockPersona.entitlements();
    const kinds = new Set(entitlements.map((e) => e.kind));
    expect(kinds).toEqual(new Set(["item", "theme", "title"]));
    // equips the seed spec actually wears must be owned — coherence
    const spec = viewerSpecSnapshot();
    for (const slot of ["hair", "hat", "shirt", "glasses", "frame"] as const) {
      const id = spec[slot];
      if (id) expect(ownsCatalogItem(entitlements, id)).toBe(true);
    }
    // unowned set stays unowned (try-on yes, equip no)
    expect(ownsCatalogItem(entitlements, "shirt:pinstripe")).toBe(false);
    expect(entitlements.some((e) => e.kind === "theme" && e.key === "speakeasy")).toBe(true);
  });
});
