import type { CatalogName } from "./catalog-name.js";
import type { CardNameIndex } from "./card-name-index.js";

export class InMemoryCardNameIndex implements CardNameIndex {
  private readonly byNormalized = new Map<string, CatalogName>();

  constructor(cards: readonly CatalogName[]) {
    for (const card of cards) {
      this.byNormalized.set(card.nameNormalized, card);
    }
  }

  findExact(normalized: string): CatalogName | undefined {
    return this.byNormalized.get(normalized);
  }
}
