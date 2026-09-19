import { describe, expect, it } from "vitest";
import { ScryfallId } from "./scryfall-id.js";

describe("ScryfallId", () => {
  it("accepts a canonical UUID and compares by value", () => {
    const left = ScryfallId.from("E3285E6B-B12A-4E6A-8A1F-0F0C1B7A1111");
    const right = ScryfallId.from("e3285e6b-b12a-4e6a-8a1f-0f0c1b7a1111");

    expect(left.toString()).toBe("e3285e6b-b12a-4e6a-8a1f-0f0c1b7a1111");
    expect(left.equals(right)).toBe(true);
  });

  it("rejects a non-UUID so a card name cannot pass as identity", () => {
    expect(() => ScryfallId.from("Lightning Bolt")).toThrow(/invalid scryfall id/i);
    expect(() => ScryfallId.from("")).toThrow(/invalid scryfall id/i);
  });
});
