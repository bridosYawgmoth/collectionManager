import { describe, expect, it } from "vitest";
import { normalizeCardName } from "./normalize-card-name.js";

describe("normalizeCardName", () => {
  it("strips diacritics and ligatures so spoken forms share a key", () => {
    expect(normalizeCardName("Ætherize")).toBe("aetherize");
    expect(normalizeCardName("Lim-Dûl's Vault")).toBe("lim duls vault");
    expect(normalizeCardName("Jötun Grunt")).toBe("jotun grunt");
  });

  it("collapses punctuation and case without changing identity-bearing words", () => {
    expect(normalizeCardName("Urza's Saga")).toBe("urzas saga");
    expect(normalizeCardName("  Lightning   Bolt  ")).toBe("lightning bolt");
  });

  it("returns empty when the transcript has no letters or digits", () => {
    expect(normalizeCardName("...")).toBe("");
    expect(normalizeCardName("")).toBe("");
  });
});
