import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createSql, type SqlClient } from "../../platform/db.js";
import { applyMigrations } from "../../platform/migrate.js";
import { EmptyBulkError, parseDefaultCardsFile, parseOracleCardsFile } from "./parse-scryfall-bulk.js";
import { PostgresCardCatalog } from "./postgres-card-catalog.js";
import { refreshCatalog } from "./refresh-catalog.js";

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

const fixtures = resolve(import.meta.dirname, "__fixtures__");

describe("refreshCatalog against Postgres", () => {
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

  it("upserts fixture bulk files and rebuilds the trigram index", async () => {
    const oracle = await parseOracleCardsFile(resolve(fixtures, "oracle-cards.json"));
    const printings = await parseDefaultCardsFile(resolve(fixtures, "default-cards.json"));

    const report = await refreshCatalog({
      catalog,
      source: {
        load: () =>
          Promise.resolve({
            cards: oracle.cards,
            printings: printings.printings,
            skippedCards: oracle.skipped,
            skippedPrintings: printings.skipped,
          }),
      },
      rebuildTrigramIndex: () => catalog.rebuildTrigramIndex(),
    });

    expect(report.cardsAfter).toBe(1);
    expect(report.printingsAfter).toBe(1);
    expect(report.skippedCards).toBe(1);
    expect(report.skippedPrintings).toBe(1);
    expect(report.newSetCodes).toEqual(["gtc"]);
    expect(report.trigramIndexRebuilt).toBe(true);
    expect(await catalog.counts()).toEqual({ cards: 1, printings: 1 });
  });

  it("leaves existing rows untouched when the bulk file is empty", async () => {
    const oracle = await parseOracleCardsFile(resolve(fixtures, "oracle-cards.json"));
    await catalog.upsertCards(oracle.cards);

    await expect(
      refreshCatalog({
        catalog,
        source: {
          load: () => parseOracleCardsFile(resolve(fixtures, "empty.json")).then((parsed) => ({
            cards: parsed.cards,
            printings: [],
            skippedCards: parsed.skipped,
            skippedPrintings: 0,
          })),
        },
      }),
    ).rejects.toThrow(EmptyBulkError);

    expect(await catalog.counts()).toEqual({ cards: 1, printings: 0 });
  });
});
