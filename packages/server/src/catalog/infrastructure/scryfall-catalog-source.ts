import { join } from "node:path";
import { parseDefaultCardsFile, parseOracleCardsFile } from "./parse-scryfall-bulk.js";
import type { CatalogBulkLoad, CatalogBulkSource } from "./refresh-catalog.js";
import type { ScryfallBulkClient } from "./scryfall-bulk-client.js";

const INTER_REQUEST_DELAY_MS = 100;

export interface ScryfallCatalogSourceOptions {
  client: ScryfallBulkClient;
  dataDir: string;
  sleep?: (ms: number) => Promise<void>;
}

export class ScryfallCatalogSource implements CatalogBulkSource {
  private readonly client: ScryfallBulkClient;
  private readonly dataDir: string;
  private readonly sleep: (ms: number) => Promise<void>;

  constructor(options: ScryfallCatalogSourceOptions) {
    this.client = options.client;
    this.dataDir = options.dataDir;
    this.sleep = options.sleep ?? defaultSleep;
  }

  async load(): Promise<CatalogBulkLoad> {
    const oraclePath = join(this.dataDir, "oracle_cards.json");
    const defaultPath = join(this.dataDir, "default_cards.json");

    await this.client.downloadBulkType({ type: "oracle_cards", destPath: oraclePath });
    await this.sleep(INTER_REQUEST_DELAY_MS);
    await this.client.downloadBulkType({ type: "default_cards", destPath: defaultPath });

    const oracle = await parseOracleCardsFile(oraclePath);
    const printings = await parseDefaultCardsFile(defaultPath);
    return {
      cards: oracle.cards,
      printings: printings.printings,
      skippedCards: oracle.skipped,
      skippedPrintings: printings.skipped,
    };
  }
}

async function defaultSleep(ms: number): Promise<void> {
  await new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });
}
