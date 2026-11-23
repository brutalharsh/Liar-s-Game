import { describe, expect, it } from "vitest";
import { parseCodeFromPasted, sanitizeNickname, sanitizeRoomCode, isValidRoomCode } from "@/lib/sanitize";

describe("sanitizeNickname", () => {
  it("trims, collapses whitespace and caps at 12 chars", () => {
    expect(sanitizeNickname("  sue   mac ")).toEqual({ value: "sue mac", error: null });
    expect(sanitizeNickname("  ")).toEqual({ value: "", error: "Pick a nickname first." });
    expect(sanitizeNickname("x")).toEqual({ value: "x", error: "At least 2 characters." });
  });
});

describe("sanitizeRoomCode / isValidRoomCode", () => {
  it("uppercases, drops confusables and caps at 5", () => {
    expect(sanitizeRoomCode("abc7e")).toBe("ABC7E");
    expect(sanitizeRoomCode("il1o0")).toBe(""); // I/L/O/0/1 are confusable-dropped
    expect(sanitizeRoomCode("ABC7EFGH")).toBe("ABC7E");
    expect(isValidRoomCode("ABC7E")).toBe(true);
    expect(isValidRoomCode("ABC7")).toBe(false);
    expect(isValidRoomCode("iloi")).toBe(false);
  });
});

describe("parseCodeFromPasted — U3 P1-b (protocol letters never win)", () => {
  it("extracts the /r/ segment from a full invite URL", () => {
    expect(parseCodeFromPasted("https://liars.game/r/ABC7E")).toBe("ABC7E");
    expect(parseCodeFromPasted("https://liars.game/r/ABC7E/")).toBe("ABC7E");
    expect(parseCodeFromPasted("https://liars.game/r/ABC7E?utm=discord")).toBe("ABC7E");
  });

  it("reads lowercase codes as uppercase (matches the wire contract)", () => {
    expect(parseCodeFromPasted("abc7e")).toBe("ABC7E");
    expect(parseCodeFromPasted("https://liars.game/r/abc7e")).toBe("ABC7E");
  });

  it("keeps the bare-code path working", () => {
    expect(parseCodeFromPasted("ABC7E")).toBe("ABC7E");
    expect(parseCodeFromPasted("  QW7KM  ")).toBe("QW7KM");
  });

  it("falls back to the LAST valid ≥5-char run when there is no /r/ route", () => {
    expect(parseCodeFromPasted("come play at liars.game — code WX7QM tonight")).toBe("WX7QM");
    expect(parseCodeFromPasted("https://liars.game/rooms/TESTY")).toBe("TESTY"); // HTTPS is a run, but the last run wins
  });

  it("returns null for garbage with no code-shaped run", () => {
    expect(parseCodeFromPasted("hello world")).toBeNull();
    expect(parseCodeFromPasted("01234")).toBeNull(); // 0/1 are outside the charset
    expect(parseCodeFromPasted("ab cd")).toBeNull();
    expect(parseCodeFromPasted("")).toBeNull();
  });
});
