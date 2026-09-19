import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  BulkParseError,
  EmptyBulkError,
  parseDefaultCardsFile,
  parseOracleCardsFile,
} from "./parse-scryfall-bulk.js";

const fixtures = resolve(import.meta.dirname, "__fixtures__");
const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

const oracleJsonlCard = {
  id: "e3285e6b-b12a-4e6a-8a1f-0f0c1b7a1111",
  oracle_id: "446c7d5c-8a1a-4b0e-9c3a-0a1b2c3d4e5f",
  name: "Ætherize",
  layout: "normal",
  type_line: "Instant",
  mana_cost: "{1}{U}",
  oracle_text: "Return all attacking creatures to their owner's hand.",
  color_identity: ["U"],
  cmc: 2,
  set: "gtc",
  set_name: "Gatecrash",
  collector_number: "29",
  rarity: "uncommon",
  finishes: ["nonfoil", "foil"],
  lang: "en",
};

const skippedJsonlRow = {
  id: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
  name: "No Oracle Identity",
  set: "lea",
  collector_number: "1",
};

const defaultJsonlPrintings = [
  {
    id: "e3285e6b-b12a-4e6a-8a1f-0f0c1b7a1111",
    oracle_id: "446c7d5c-8a1a-4b0e-9c3a-0a1b2c3d4e5f",
    name: "Ætherize",
    layout: "normal",
    type_line: "Instant",
    mana_cost: "{1}{U}",
    oracle_text: "Return all attacking creatures to their owner's hand.",
    color_identity: ["U"],
    cmc: 2,
    set: "gtc",
    set_name: "Gatecrash",
    collector_number: "29",
    rarity: "uncommon",
    finishes: ["nonfoil", "foil"],
    lang: "en",
    image_uris: {
      normal: "https://cards.scryfall.io/normal/front/e/3/e3285e6b.jpg",
    },
    set_icon_svg_uri: "https://svgs.scryfall.io/sets/gtc.svg",
    prices: { usd: "0.25", usd_foil: "0.80" },
    released_at: "2013-02-01",
  },
  {
    id: "11111111-2222-3333-4444-555555555555",
    oracle_id: "66666666-7777-8888-9999-000000000000",
    name: "Delver of Secrets // Insectile Aberration",
    layout: "transform",
    type_line: "Creature — Human Wizard // Creature — Insect",
    color_identity: ["U"],
    cmc: 1,
    set: "isd",
    set_name: "Innistrad",
    collector_number: "51",
    rarity: "common",
    finishes: ["nonfoil"],
    lang: "en",
    card_faces: [
      {
        name: "Delver of Secrets",
        image_uris: {
          normal: "https://cards.scryfall.io/normal/front/1/1/delver.jpg",
        },
      },
    ],
    set_icon_svg_uri: "https://svgs.scryfall.io/sets/isd.svg",
    released_at: "2011-09-30",
  },
];

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

  it("fails when a JSON object is not a usable oracle card", async () => {
    await expect(parseOracleCardsFile(resolve(fixtures, "not-array.json"))).rejects.toThrow(
      EmptyBulkError,
    );
  });

  it("maps oracle identity from JSONL (one card object per line)", async () => {
    const path = await writeTemp("oracle_cards.jsonl", [
      JSON.stringify(oracleJsonlCard),
      JSON.stringify(skippedJsonlRow),
    ].join("\n"));

    const result = await parseOracleCardsFile(path);

    expect(result.cards).toHaveLength(1);
    expect(result.skipped).toBe(1);
    expect(result.cards[0]?.name).toBe("Ætherize");
  });

  it("maps a single-line JSONL file that is a valid card object, not a JSON array", async () => {
    const path = await writeTemp("one-card.jsonl", `${JSON.stringify(oracleJsonlCard)}\n`);

    const result = await parseOracleCardsFile(path);

    expect(result.cards).toHaveLength(1);
    expect(result.cards[0]?.name).toBe("Ætherize");
  });

  it("fails when a JSONL line is malformed", async () => {
    const path = await writeTemp("malformed.jsonl", `${JSON.stringify(oracleJsonlCard)}\n{not json\n`);

    await expect(parseOracleCardsFile(path)).rejects.toThrow(BulkParseError);
  });

  it("fails when the JSONL file is empty", async () => {
    const path = await writeTemp("empty.jsonl", "\n\n  \n");

    await expect(parseOracleCardsFile(path)).rejects.toThrow(EmptyBulkError);
  });

  it("fails when the bulk file has zero bytes", async () => {
    const path = await writeTemp("zero.jsonl", "");

    await expect(parseOracleCardsFile(path)).rejects.toThrow(EmptyBulkError);
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

  it("maps printings from JSONL (one printing object per line)", async () => {
    const path = await writeTemp(
      "default_cards.jsonl",
      defaultJsonlPrintings.map((row) => JSON.stringify(row)).join("\n"),
    );

    const result = await parseDefaultCardsFile(path);

    expect(result.printings).toHaveLength(2);
    expect(result.printings[0]?.scryfallId.toString()).toBe(
      "e3285e6b-b12a-4e6a-8a1f-0f0c1b7a1111",
    );
    expect(result.printings[1]?.imageUris.normal).toBe(
      "https://cards.scryfall.io/normal/front/1/1/delver.jpg",
    );
  });
});

async function writeTemp(name: string, contents: string): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "scryfall-jsonl-"));
  tempDirs.push(dir);
  const path = join(dir, name);
  await writeFile(path, contents);
  return path;
}
