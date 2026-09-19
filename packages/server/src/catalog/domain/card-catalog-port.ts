import type { Card } from "./card.js";
import type { OracleId } from "./oracle-id.js";
import type { Printing } from "./printing.js";
import type { ScryfallId } from "./scryfall-id.js";
import type { SetCode } from "./set-code.js";

export interface CatalogCounts {
  cards: number;
  printings: number;
}

// CardCatalogPort: lets Resolution query the Scryfall mirror without
// depending on Postgres. Without it, the resolver fixture suite cannot
// run against an in-memory catalog.
export interface CardCatalogPort {
  upsertCards(cards: readonly Card[]): Promise<void>;
  upsertPrintings(printings: readonly Printing[]): Promise<void>;
  getCard(oracleId: OracleId): Promise<Card | null>;
  getPrinting(scryfallId: ScryfallId): Promise<Printing | null>;
  counts(): Promise<CatalogCounts>;
  setCodes(): Promise<readonly SetCode[]>;
}
