import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  BulkParseError,
  EmptyBulkError,
  parseDefaultCardsFile,
  parseOracleCardsFile,
} from "./parse-scryfall-bulk.js";

const fixtures = resolve(import.meta.dirname, "__fixtures__");

describe("parseOracleCardsFile", () => {
  it("maps oracle identity from the spoken printed name, skipping rows without oracle_id", async () => {
    const result = await parseOracleCardsFile(resolve(fixtures, "oracle-cards.json"));

    expect(result.cards).toHaveLength(1);
    expect(result.skipped).toBe(1);
    expect(result.cards[0]?.name).toBe("Ætherize");
    expect(result.cards[0]?.nameNormalized).toBe("aetherize");
    expect(result.cards[0]?.oracleId.toString()).toBe("446c7d5c-8a1a-4b0e-9c3a-0a1b2c3d4e5f");
  });

  it("fails when the bulk file is missing", async () => {
    await expect(parseOracleCardsFile(resolve(fixtures, "does-not-exist.json"))).rejects.toThrow(
      BulkParseError,
    );
  });

  it("fails when the bulk array is empty", async () => {
    await expect(parseOracleCardsFile(resolve(fixtures, "empty.json"))).rejects.toThrow(
      EmptyBulkError,
    );
  });

  it("fails when the file is JSON but not an array", async () => {
    await expect(parseOracleCardsFile(resolve(fixtures, "not-array.json"))).rejects.toThrow(
      BulkParseError,
    );
  });
});

describe("parseDefaultCardsFile", () => {
  it("maps printings keyed on scryfall_id and falls back to face image URLs", async () => {
    const result = await parseDefaultCardsFile(resolve(fixtures, "default-cards.json"));

    expect(result.printings).toHaveLength(2);
    expect(result.printings[0]?.scryfallId.toString()).toBe(
      "e3285e6b-b12a-4e6a-8a1f-0f0c1b7a1111",
    );
    expect(result.printings[0]?.imageUris.normal).toBe(
      "https://cards.scryfall.io/normal/front/e/3/e3285e6b.jpg",
    );
    expect(result.printings[0]?.prices.usdFoil).toBe("0.80");
    expect(result.printings[1]?.imageUris.normal).toBe(
      "https://cards.scryfall.io/normal/front/1/1/delver.jpg",
    );
  });
});
