import { describe, expect, it } from "vitest";
import { phoneticCodes } from "./phonetic-code.js";

describe("phoneticCodes", () => {
  it("gives ether eyes the same codes as aetherize", () => {
    const spoken = new Set(phoneticCodes("ether eyes"));
    const card = new Set(phoneticCodes("aetherize"));
    expect([...spoken].some((code) => card.has(code))).toBe(true);
  });

  it("returns no codes for an empty string", () => {
    expect(phoneticCodes("")).toEqual([]);
  });
});
