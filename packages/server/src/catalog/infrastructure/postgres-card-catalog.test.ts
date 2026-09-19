import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { Card } from "../domain/card.js";
import { CollectorNumber } from "../domain/collector-number.js";
import { OracleId } from "../domain/oracle-id.js";
import { Printing } from "../domain/printing.js";
import { ScryfallId } from "../domain/scryfall-id.js";
import { SetCode } from "../domain/set-code.js";
import { createSql, type SqlClient } from "../../platform/db.js";
import { applyMigrations } from "../../platform/migrate.js";
import { PostgresCardCatalog } from "./postgres-card-catalog.js";

function testDatabaseUrl(): string {
  if (process.env.DATABASE_URL !== undefined && process.env.DATABASE_URL !== "") {
    return process.env.DATABASE_URL;
  }
  const user = process.env.USER;
  if (user === undefined || user === "") {
    throw new Error(
      "DATABASE_URL is unset and USER is unset; cannot derive a local connection string",
    );
  }
  return `postgres://${user}@localhost:5432/collection_manager_test`;
}

const ORACLE = OracleId.from("446c7d5c-8a1a-4b0e-9c3a-0a1b2c3d4e5f");
const SCRYFALL = ScryfallId.from("e3285e6b-b12a-4e6a-8a1f-0f0c1b7a1111");

function aetherize(): Card {
  return Card.create({
    oracleId: ORACLE,
    name: "Ætherize",
    layout: "normal",
    typeLine: "Instant",
    manaCost: "{1}{U}",
    oracleText: "Return all attacking creatures to their owner's hand.",
    colorIdentity: ["U"],
    cmc: 2,
  });
}

function gatecrashPrinting(): Printing {
  return Printing.create({
    scryfallId: SCRYFALL,
    oracleId: ORACLE,
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
}

describe("PostgresCardCatalog", () => {
  const clients: SqlClient[] = [];
  let sql: SqlClient;
  let catalog: PostgresCardCatalog;

  beforeEach(async () => {
    sql = createSql(testDatabaseUrl());
    clients.push(sql);
    await applyMigrations(sql);
    await sql`TRUNCATE printings, cards`;
    catalog = new PostgresCardCatalog(sql);
  });

  afterEach(async () => {
    await Promise.all(clients.splice(0).map((client) => client.end({ timeout: 2 })));
  });

  it("round-trips a card and printing keyed on oracle_id and scryfall_id", async () => {
    await catalog.upsertCards([aetherize()]);
    await catalog.upsertPrintings([gatecrashPrinting()]);

    const card = await catalog.getCard(ORACLE);
    const printing = await catalog.getPrinting(SCRYFALL);

    expect(card?.name).toBe("Ætherize");
    expect(card?.nameNormalized).toBe("aetherize");
    expect(card?.colorIdentity).toEqual(["U"]);
    expect(card?.cmc).toBe(2);
    expect(printing?.setCode.toString()).toBe("gtc");
    expect(printing?.collectorNumber.toString()).toBe("29");
    expect(printing?.imageUris.normal).toBe(
      "https://cards.scryfall.io/normal/front/e/3/e3285e6b.jpg",
    );
    expect(printing?.prices.usdFoil).toBe("0.80");
    expect(await catalog.counts()).toEqual({ cards: 1, printings: 1 });
    expect((await catalog.setCodes()).map((code) => code.toString())).toEqual(["gtc"]);
  });

  it("updates an existing card on oracle_id conflict instead of duplicating", async () => {
    await catalog.upsertCards([aetherize()]);
    await catalog.upsertCards([
      Card.create({
        oracleId: ORACLE,
        name: "Aetherize",
        layout: "normal",
        typeLine: "Instant",
        manaCost: "{3}{U}",
        oracleText: "updated",
        colorIdentity: ["U"],
        cmc: 4,
      }),
    ]);

    const card = await catalog.getCard(ORACLE);
    expect(card?.name).toBe("Aetherize");
    expect(card?.manaCost).toBe("{3}{U}");
    expect(card?.cmc).toBe(4);
    expect(await catalog.counts()).toEqual({ cards: 1, printings: 0 });
  });

  it("leaves the catalog unchanged when upserting an empty batch", async () => {
    await catalog.upsertCards([]);
    await catalog.upsertPrintings([]);
    expect(await catalog.counts()).toEqual({ cards: 0, printings: 0 });
  });
});
