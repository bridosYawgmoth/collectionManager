import { describe, expect, it } from "vitest";
import { CollectorNumber } from "./collector-number.js";
import { OracleId } from "./oracle-id.js";
import { Printing } from "./printing.js";
import { ScryfallId } from "./scryfall-id.js";
import { SetCode } from "./set-code.js";

describe("Printing", () => {
  it("holds image URLs rather than image bytes", () => {
    const printing = Printing.create({
      scryfallId: ScryfallId.from("e3285e6b-b12a-4e6a-8a1f-0f0c1b7a1111"),
      oracleId: OracleId.from("446c7d5c-8a1a-4b0e-9c3a-0a1b2c3d4e5f"),
      setCode: SetCode.from("gtc"),
      setName: "Gatecrash",
      collectorNumber: CollectorNumber.from("29"),
      rarity: "uncommon",
      finishes: ["nonfoil", "foil"],
      lang: "en",
      imageUris: {
        normal: "https://cards.scryfall.io/normal/front/e/3/e3285e6b.jpg",
      },
      setIconSvgUri: "https://svgs.scryfall.io/sets/gtc.svg",
      prices: { usd: "0.25", usdFoil: "0.80" },
      releasedAt: "2013-02-01",
    });

    expect(printing.scryfallId.toString()).toBe("e3285e6b-b12a-4e6a-8a1f-0f0c1b7a1111");
    expect(printing.setCode.toString()).toBe("gtc");
    expect(printing.imageUris.normal).toBe(
      "https://cards.scryfall.io/normal/front/e/3/e3285e6b.jpg",
    );
    expect(printing.setIconSvgUri).toBe("https://svgs.scryfall.io/sets/gtc.svg");
  });

  it("rejects an empty finish list", () => {
    expect(() =>
      Printing.create({
        scryfallId: ScryfallId.from("e3285e6b-b12a-4e6a-8a1f-0f0c1b7a1111"),
        oracleId: OracleId.from("446c7d5c-8a1a-4b0e-9c3a-0a1b2c3d4e5f"),
        setCode: SetCode.from("gtc"),
        setName: "Gatecrash",
        collectorNumber: CollectorNumber.from("29"),
        rarity: "uncommon",
        finishes: [],
        lang: "en",
        imageUris: {},
        prices: {},
        releasedAt: "2013-02-01",
      }),
    ).toThrow(/finish/i);
  });
});
