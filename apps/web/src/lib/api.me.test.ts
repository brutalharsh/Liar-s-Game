import { beforeEach, describe, expect, it } from "vitest";
import { resetViewerPersona, viewerNicknameSnapshot, viewerSpecSnapshot } from "@/lib/mock/persona";
import {
  equipSlot,
  getEntitlements,
  getProfile,
  updateProfile,
  type ApiError,
} from "@/lib/api";

/**
 * ============================================================================
 * /api/me client tests (mock mode — vitest's node env defaults to mock):
 * equipSlot / updateProfile / getEntitlements / getProfile all speak the
 * frozen T3 contract through the same adapter the settings dashboard uses.
 * ============================================================================
 */

beforeEach(() => {
  resetViewerPersona();
});

describe("equipSlot — mock adapter", () => {
  it("returns the server-shaped ack (spec is the truth)", async () => {
    const ack = await equipSlot({ slot: "glasses", itemId: "glasses:aviators" });
    expect(ack.spec.glasses).toBe("glasses:aviators");
    expect(viewerSpecSnapshot().glasses).toBe("glasses:aviators");
  });

  it("rejects 403 EQUIPMENT_NOT_OWNED as a typed ApiError", async () => {
    try {
      await equipSlot({ slot: "base", itemId: "dog" });
      expect.unreachable("unowned body must 403");
    } catch (err) {
      const apiErr = err as ApiError;
      expect(apiErr.error).toBe("EQUIPMENT_NOT_OWNED");
      expect(apiErr.status).toBe(403);
    }
  });
});

describe("updateProfile — mock adapter", () => {
  it("renames through the api client and reflects on /api/me", async () => {
    const ack = await updateProfile({ nickname: "Maverick the Meek" });
    expect(ack.nickname).toBe("Maverick the Meek");
    expect(viewerNicknameSnapshot()).toBe("Maverick the Meek");

    const profile = await getProfile();
    expect(profile.user.nickname).toBe("Maverick the Meek");
  });
});

describe("getEntitlements — mock adapter", () => {
  it("serves the rich persona inventory shape", async () => {
    const { entitlements } = await getEntitlements();
    expect(entitlements.length).toBeGreaterThan(10);
    expect(entitlements.some((e) => e.kind === "item" && e.key === "bowler")).toBe(false);
    expect(entitlements.some((e) => e.kind === "item" && e.key === "cowboy")).toBe(true);
  });
});
