import { afterEach, describe, expect, it } from "vitest";
import { createSql, type SqlClient } from "./db.js";
import { applyMigrations } from "./migrate.js";

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

function adminUrl(databaseUrl: string): string {
  const url = new URL(databaseUrl);
  url.pathname = "/postgres";
  return url.toString();
}

async function enabledExtensions(sql: SqlClient): Promise<string[]> {
  const rows = await sql<{ extname: string }[]>`
    SELECT extname
    FROM pg_extension
    WHERE extname IN ('pg_trgm', 'fuzzystrmatch')
    ORDER BY extname
  `;
  return rows.map((row) => row.extname);
}

describe("applyMigrations", () => {
  const clients: SqlClient[] = [];

  afterEach(async () => {
    await Promise.all(clients.splice(0).map((sql) => sql.end({ timeout: 2 })));
  });

  it("enables pg_trgm and fuzzystrmatch on a fresh database", async () => {
    const admin = createSql(adminUrl(testDatabaseUrl()));
    clients.push(admin);
    const dbName = `cm_migrate_${String(Date.now())}`;

    await admin.unsafe(`CREATE DATABASE ${dbName}`);
    try {
      const url = new URL(testDatabaseUrl());
      url.pathname = `/${dbName}`;
      const sql = createSql(url.toString());
      clients.push(sql);

      await applyMigrations(sql);

      expect(await enabledExtensions(sql)).toEqual(["fuzzystrmatch", "pg_trgm"]);
    } finally {
      await admin.unsafe(`DROP DATABASE IF EXISTS ${dbName} WITH (FORCE)`);
    }
  });

  it("is idempotent when applied twice", async () => {
    const admin = createSql(adminUrl(testDatabaseUrl()));
    clients.push(admin);
    const dbName = `cm_migrate_twice_${String(Date.now())}`;

    await admin.unsafe(`CREATE DATABASE ${dbName}`);
    try {
      const url = new URL(testDatabaseUrl());
      url.pathname = `/${dbName}`;
      const sql = createSql(url.toString());
      clients.push(sql);

      await applyMigrations(sql);
      await applyMigrations(sql);

      expect(await enabledExtensions(sql)).toEqual(["fuzzystrmatch", "pg_trgm"]);
    } finally {
      await admin.unsafe(`DROP DATABASE IF EXISTS ${dbName} WITH (FORCE)`);
    }
  });
});
