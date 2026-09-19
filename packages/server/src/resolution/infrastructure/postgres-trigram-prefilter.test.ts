import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { Card } from "../../catalog/domain/card.js";
import { OracleId } from "../../catalog/domain/oracle-id.js";
import { createSql, type SqlClient } from "../../platform/db.js";
import { applyMigrations } from "../../platform/migrate.js";
import { PostgresCardCatalog } from "../../catalog/infrastructure/postgres-card-catalog.js";
import { CardResolver } from "../domain/card-resolver.js";
import { InMemoryCardNameIndex } from "../domain/in-memory-card-name-index.js";
import { catalogNameFrom } from "../domain/catalog-name.js";
import { PostgresTrigramPrefilter } from "./postgres-trigram-prefilter.js";
import { ResolveSpokenName } from "../application/resolve-spoken-name.js";

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

const LIMDUL = OracleId.from("446c7d5c-8a1a-4b0e-9c3a-0a1b2c3d4e51");
const BOLT = OracleId.from("446c7d5c-8a1a-4b0e-9c3a-0a1b2c3d4e52");
const AETHERIZE = OracleId.from("446c7d5c-8a1a-4b0e-9c3a-0a1b2c3d4e53");

function card(oracleId: OracleId, name: string): Card {
  return Card.create({
    oracleId,
    name,
    layout: "normal",
    typeLine: "Instant",
    manaCost: "",
    oracleText: "",
    colorIdentity: [],
    cmc: 0,
  });
}

describe("PostgresTrigramPrefilter", () => {
  const clients: SqlClient[] = [];
  let sql: SqlClient;
  let prefilter: PostgresTrigramPrefilter;

  beforeEach(async () => {
    sql = createSql(testDatabaseUrl());
    clients.push(sql);
    await applyMigrations(sql);
    await sql`TRUNCATE printings, cards`;
    const catalog = new PostgresCardCatalog(sql);
    await catalog.upsertCards([
      card(LIMDUL, "Lim-Dûl's Vault"),
      card(BOLT, "Lightning Bolt"),
      card(AETHERIZE, "Ætherize"),
    ]);
    prefilter = new PostgresTrigramPrefilter(sql);
  });

  afterEach(async () => {
    await Promise.all(clients.splice(0).map((client) => client.end({ timeout: 2 })));
  });

  it("returns names that share trigrams and omits unrelated cards", async () => {
    const candidates = await prefilter.findSimilar({
      normalized: "limb duals vault",
      limit: 10,
    });
    const names = candidates.map((candidate) => candidate.name);

    expect(names).toContain("Lim-Dûl's Vault");
    expect(names).not.toContain("Lightning Bolt");
  });

  it("does not treat ether eyes as a trigram neighbor of Ætherize", async () => {
    const candidates = await prefilter.findSimilar({
      normalized: "ether eyes",
      limit: 10,
    });
    expect(candidates.map((candidate) => candidate.name)).not.toContain("Ætherize");
  });

  it("lets TypeScript ranking identify a prefiltered trigram hit", async () => {
    const index = new InMemoryCardNameIndex([
      catalogNameFrom({ oracleId: LIMDUL, name: "Lim-Dûl's Vault" }),
      catalogNameFrom({ oracleId: BOLT, name: "Lightning Bolt" }),
      catalogNameFrom({ oracleId: AETHERIZE, name: "Ætherize" }),
    ]);
    const useCase = new ResolveSpokenName({
      resolver: new CardResolver(index),
      trigramSource: prefilter,
    });

    const result = await useCase.execute("limb duals vault");
    expect(result.status).toBe("matched");
    if (result.status !== "matched") {
      return;
    }
    expect(result.winner.card.name).toBe("Lim-Dûl's Vault");
    expect(result.winner.stage).toBe("trigram");
  });

  it("returns no rows for an empty spoken string", async () => {
    expect(await prefilter.findSimilar({ normalized: "", limit: 10 })).toEqual([]);
  });
});
