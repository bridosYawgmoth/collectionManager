import { afterEach, describe, expect, it } from "vitest";
import { createSql, type SqlClient } from "../../platform/db.js";
import { applyMigrations } from "../../platform/migrate.js";

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

describe("catalog schema", () => {
  const clients: SqlClient[] = [];

  afterEach(async () => {
    await Promise.all(clients.splice(0).map((sql) => sql.end({ timeout: 2 })));
  });

  it("keys cards on oracle_id and printings on scryfall_id", async () => {
    const sql = createSql(testDatabaseUrl());
    clients.push(sql);
    await applyMigrations(sql);

    const columns = await sql<{ table_name: string; column_name: string }[]>`
      SELECT table_name, column_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name IN ('cards', 'printings')
      ORDER BY table_name, column_name
    `;
    const cardColumns = columns
      .filter((row) => row.table_name === "cards")
      .map((row) => row.column_name);
    const printingColumns = columns
      .filter((row) => row.table_name === "printings")
      .map((row) => row.column_name);

    expect(cardColumns).toEqual(
      expect.arrayContaining([
        "oracle_id",
        "name",
        "name_normalized",
        "layout",
        "type_line",
        "mana_cost",
        "oracle_text",
        "color_identity",
        "cmc",
      ]),
    );
    expect(printingColumns).toEqual(
      expect.arrayContaining([
        "scryfall_id",
        "oracle_id",
        "set_code",
        "collector_number",
        "image_uris",
        "set_icon_svg_uri",
        "prices",
      ]),
    );

    const pks = await sql<{ table_name: string; column_name: string }[]>`
      SELECT tc.table_name, kcu.column_name
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name = kcu.constraint_name
      WHERE tc.constraint_type = 'PRIMARY KEY'
        AND tc.table_name IN ('cards', 'printings')
      ORDER BY tc.table_name
    `;
    expect(pks).toEqual([
      { table_name: "cards", column_name: "oracle_id" },
      { table_name: "printings", column_name: "scryfall_id" },
    ]);
  });

  it("indexes normalized names with a GIN trigram operator for later prefilter", async () => {
    const sql = createSql(testDatabaseUrl());
    clients.push(sql);
    await applyMigrations(sql);

    const indexes = await sql<{ indexname: string; indexdef: string }[]>`
      SELECT indexname, indexdef
      FROM pg_indexes
      WHERE schemaname = 'public'
        AND indexname = 'cards_name_normalized_trgm'
    `;

    expect(indexes).toHaveLength(1);
    const definition = indexes[0]?.indexdef ?? "";
    expect(definition).toMatch(/USING gin/i);
    expect(definition).toMatch(/gin_trgm_ops/);
    expect(definition).toMatch(/name_normalized/);
  });
});
