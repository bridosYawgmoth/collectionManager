import { describe, expect, it } from "vitest";
import { CollectorNumber } from "./collector-number.js";

describe("CollectorNumber", () => {
  it("preserves Scryfall collector numbers including suffixes", () => {
    expect(CollectorNumber.from("150").toString()).toBe("150");
    expect(CollectorNumber.from("1a").toString()).toBe("1a");
    expect(CollectorNumber.from("★").toString()).toBe("★");
  });

  it("rejects a blank collector number", () => {
    expect(() => CollectorNumber.from("")).toThrow(/invalid collector number/i);
    expect(() => CollectorNumber.from("   ")).toThrow(/invalid collector number/i);
  });
});
