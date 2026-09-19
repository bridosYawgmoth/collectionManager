import { loadConfig } from "../../platform/config.js";
import { createSql } from "../../platform/db.js";
import { applyMigrations } from "../../platform/migrate.js";
import { PostgresCardCatalog } from "./postgres-card-catalog.js";
import { refreshCatalog, type CatalogRefreshReport } from "./refresh-catalog.js";
import { ScryfallBulkClient } from "./scryfall-bulk-client.js";
import { ScryfallCatalogSource } from "./scryfall-catalog-source.js";

const config = loadConfig();
const sql = createSql(config.databaseUrl);

try {
  await applyMigrations(sql);
  const catalog = new PostgresCardCatalog(sql);
  const source = new ScryfallCatalogSource({
    client: new ScryfallBulkClient({ userAgent: config.scryfallUserAgent }),
    dataDir: config.scryfallDataDir,
  });
  const report = await refreshCatalog({
    catalog,
    source,
    rebuildTrigramIndex: () => catalog.rebuildTrigramIndex(),
  });
  process.stdout.write(formatReport(report));
} finally {
  await sql.end({ timeout: 2 });
}

function formatReport(report: CatalogRefreshReport): string {
  const sets = report.newSetCodes.length === 0 ? "(none)" : report.newSetCodes.join(", ");
  return [
    `cards: ${String(report.cardsBefore)} -> ${String(report.cardsAfter)} (${formatDelta(report.cardsAfter - report.cardsBefore)})`,
    `printings: ${String(report.printingsBefore)} -> ${String(report.printingsAfter)} (${formatDelta(report.printingsAfter - report.printingsBefore)})`,
    `new sets: ${sets}`,
    `skipped cards: ${String(report.skippedCards)}`,
    `skipped printings: ${String(report.skippedPrintings)}`,
    `trigram index rebuilt: ${report.trigramIndexRebuilt ? "yes" : "no"}`,
    "phonetic index: not yet (resolution context)",
    "",
  ].join("\n");
}

function formatDelta(delta: number): string {
  if (delta > 0) {
    return `+${String(delta)}`;
  }
  return String(delta);
}
