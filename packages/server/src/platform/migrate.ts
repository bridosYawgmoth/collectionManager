import { readdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { SqlClient } from "./db.js";

const defaultMigrationsDir = resolve(import.meta.dirname, "../../migrations");

// applyMigrations: applies ordered SQL files once, recorded in
// schema_migrations. Buys a home for later catalog DDL without re-running
// irreversible statements. Without it, CREATE EXTENSION IF NOT EXISTS on
// every boot would work today but the next table-creating migration would
// have nowhere to live.
export async function applyMigrations(
  sql: SqlClient,
  migrationsDir = defaultMigrationsDir,
): Promise<void> {
  await sql.unsafe(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id text PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT now()
    )
  `);

  const files = (await readdir(migrationsDir))
    .filter((name) => name.endsWith(".sql"))
    .sort((left, right) => left.localeCompare(right));

  for (const file of files) {
    const already = await sql<{ id: string }[]>`
      SELECT id FROM schema_migrations WHERE id = ${file}
    `;
    if (already.length > 0) {
      continue;
    }

    const contents = await readFile(resolve(migrationsDir, file), "utf8");
    await sql.unsafe(contents);
    await sql`INSERT INTO schema_migrations (id) VALUES (${file})`;
  }
}
