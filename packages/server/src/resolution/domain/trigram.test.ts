import { describe, expect, it } from "vitest";
import { trigramSimilarity } from "./trigram.js";

describe("trigramSimilarity", () => {
  it("is 1 for identical strings and near 1 for a one-character edit", () => {
    expect(trigramSimilarity("lim duls vault", "lim duls vault")).toBe(1);
    expect(trigramSimilarity("limb duals vault", "lim duls vault")).toBeGreaterThan(0.5);
    expect(trigramSimilarity("limb duals vault", "lightning bolt")).toBeLessThan(0.2);
  });

  it("returns 0 when either side is empty", () => {
    expect(trigramSimilarity("", "bolt")).toBe(0);
    expect(trigramSimilarity("bolt", "")).toBe(0);
  });
});
