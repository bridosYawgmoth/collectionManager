import { describe, expect, it } from "vitest";
import { Card } from "./card.js";
import { OracleId } from "./oracle-id.js";

const ORACLE = "446c7d5c-8a1a-4b0e-9c3a-0a1b2c3d4e5f";

describe("Card", () => {
  it("derives a normalized name from the printed oracle name", () => {
    const card = Card.create({
      oracleId: OracleId.from(ORACLE),
      name: "Ætherize",
      layout: "normal",
      typeLine: "Instant",
      manaCost: "{1}{U}",
      oracleText: "Return all attacking creatures to their owner's hand.",
      colorIdentity: ["U"],
      cmc: 2,
    });

    expect(card.name).toBe("Ætherize");
    expect(card.nameNormalized).toBe("aetherize");
    expect(card.oracleId.equals(OracleId.from(ORACLE))).toBe(true);
    expect(card.colorIdentity).toEqual(["U"]);
  });

  it("rejects a blank name so the catalog cannot store an unidentifiable card", () => {
    expect(() =>
      Card.create({
        oracleId: OracleId.from(ORACLE),
        name: "   ",
        layout: "normal",
        typeLine: "Instant",
        manaCost: "",
        oracleText: "",
        colorIdentity: [],
        cmc: 0,
      }),
    ).toThrow(/card name is required/i);
  });
});
