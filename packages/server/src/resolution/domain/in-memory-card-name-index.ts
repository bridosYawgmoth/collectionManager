import { normalizeCardName } from "../../catalog/domain/normalize-card-name.js";
import type { CardAlias } from "./aliases.js";
import { DEFAULT_CARD_ALIASES } from "./aliases.js";
import type { CatalogName } from "./catalog-name.js";
import type { CardNameIndex } from "./card-name-index.js";

export class InMemoryCardNameIndex implements CardNameIndex {
  private readonly byNormalized = new Map<string, CatalogName>();
  private readonly byAlias = new Map<string, CatalogName>();

  constructor(
    cards: readonly CatalogName[],
    aliases: readonly CardAlias[] = DEFAULT_CARD_ALIASES,
  ) {
    for (const card of cards) {
      this.byNormalized.set(card.nameNormalized, card);
    }
    for (const alias of aliases) {
      const target = this.byNormalized.get(normalizeCardName(alias.name));
      if (target === undefined) {
        continue;
      }
      this.byAlias.set(normalizeCardName(alias.spoken), target);
    }
  }

  findExact(normalized: string): CatalogName | undefined {
    return this.byNormalized.get(normalized);
  }

  findAlias(normalized: string): CatalogName | undefined {
    return this.byAlias.get(normalized);
  }
}
