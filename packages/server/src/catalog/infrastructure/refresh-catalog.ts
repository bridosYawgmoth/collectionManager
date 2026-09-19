import type { CardCatalogPort } from "../domain/card-catalog-port.js";
import type { Card } from "../domain/card.js";
import type { Printing } from "../domain/printing.js";

export interface CatalogBulkLoad {
  cards: readonly Card[];
  printings: readonly Printing[];
  skippedCards: number;
  skippedPrintings: number;
}

export interface CatalogBulkSource {
  load(): Promise<CatalogBulkLoad>;
}

export interface CatalogRefreshReport {
  cardsBefore: number;
  cardsAfter: number;
  printingsBefore: number;
  printingsAfter: number;
  newSetCodes: string[];
  skippedCards: number;
  skippedPrintings: number;
  trigramIndexRebuilt: boolean;
}

export interface RefreshCatalogOptions {
  catalog: CardCatalogPort;
  source: CatalogBulkSource;
  rebuildTrigramIndex?: () => Promise<void>;
}

// refreshCatalog lives in infrastructure (not application) because it is an
// ETL pipeline: download, parse, upsert, reindex. There is no domain decision
// to orchestrate. An application layer would be a pass-through. Promote if a
// second caller needs shared policy that is not I/O.
export async function refreshCatalog(
  options: RefreshCatalogOptions,
): Promise<CatalogRefreshReport> {
  const before = await options.catalog.counts();
  const setsBefore = new Set(
    (await options.catalog.setCodes()).map((code) => code.toString()),
  );

  const loaded = await options.source.load();
  const knownOracleIds = new Set(loaded.cards.map((card) => card.oracleId.toString()));
  const acceptedPrintings: Printing[] = [];
  let skippedUnmatched = 0;
  for (const printing of loaded.printings) {
    if (knownOracleIds.has(printing.oracleId.toString())) {
      acceptedPrintings.push(printing);
    } else {
      skippedUnmatched += 1;
    }
  }

  await options.catalog.upsertCards(loaded.cards);
  await options.catalog.upsertPrintings(acceptedPrintings);

  let trigramIndexRebuilt = false;
  if (options.rebuildTrigramIndex !== undefined) {
    await options.rebuildTrigramIndex();
    trigramIndexRebuilt = true;
  }

  const after = await options.catalog.counts();
  const newSetCodes = (await options.catalog.setCodes())
    .map((code) => code.toString())
    .filter((code) => !setsBefore.has(code));

  return {
    cardsBefore: before.cards,
    cardsAfter: after.cards,
    printingsBefore: before.printings,
    printingsAfter: after.printings,
    newSetCodes,
    skippedCards: loaded.skippedCards,
    skippedPrintings: loaded.skippedPrintings + skippedUnmatched,
    trigramIndexRebuilt,
  };
}
