import { describe, expect, it } from "vitest";
import { SetCode } from "./set-code.js";

describe("SetCode", () => {
  it("normalizes Scryfall set codes to lowercase", () => {
    expect(SetCode.from("BLB").toString()).toBe("blb");
    expect(SetCode.from("plst").equals(SetCode.from("PLST"))).toBe(true);
  });

  it("rejects empty or punctuation-only codes", () => {
    expect(() => SetCode.from("")).toThrow(/invalid set code/i);
    expect(() => SetCode.from("   ")).toThrow(/invalid set code/i);
    expect(() => SetCode.from("b.l")).toThrow(/invalid set code/i);
  });
});
