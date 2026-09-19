import { describe, expect, it } from "vitest";
import { levenshtein, levenshteinSimilarity, normalizedNameSimilarity } from "./levenshtein.js";

describe("levenshtein", () => {
  it("is zero for identical strings and counts substitutions", () => {
    expect(levenshtein("bolt", "bolt")).toBe(0);
    expect(levenshtein("confidant", "confident")).toBe(1);
    expect(levenshtein("kitten", "sitting")).toBe(3);
    expect(levenshtein("", "abc")).toBe(3);
  });

  it("scores compact spoken forms closer than spaced ones for aetherize", () => {
    expect(normalizedNameSimilarity("ether eyes", "aetherize")).toBeGreaterThan(
      levenshteinSimilarity("ether eyes", "aetherize"),
    );
    expect(normalizedNameSimilarity("ether eyes", "aetherize")).toBeGreaterThan(
      normalizedNameSimilarity("ether eyes", "authorize"),
    );
  });
});
