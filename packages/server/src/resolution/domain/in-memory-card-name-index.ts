import { normalizeCardName } from "../../catalog/domain/normalize-card-name.js";
import type { CardAlias } from "./aliases.js";
import { DEFAULT_CARD_ALIASES } from "./aliases.js";
import type { CatalogName } from "./catalog-name.js";
import type { CardNameIndex } from "./card-name-index.js";
import { phoneticCodes } from "./phonetic-code.js";

export class InMemoryCardNameIndex implements CardNameIndex {
  private readonly cards: readonly CatalogName[];
  private readonly byNormalized = new Map<string, CatalogName>();
  private readonly byAlias = new Map<string, CatalogName>();
  private readonly byPhonetic = new Map<string, CatalogName[]>();

  constructor(
    cards: readonly CatalogName[],
    aliases: readonly CardAlias[] = DEFAULT_CARD_ALIASES,
  ) {
    this.cards = cards;
    for (const card of cards) {
      this.byNormalized.set(card.nameNormalized, card);
      for (const code of phoneticCodes(card.nameNormalized)) {
        const bucket = this.byPhonetic.get(code);
        if (bucket === undefined) {
          this.byPhonetic.set(code, [card]);
        } else {
          bucket.push(card);
        }
      }
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

  findPhonetic(codes: readonly string[]): readonly CatalogName[] {
    const seen = new Set<string>();
    const matches: CatalogName[] = [];
    for (const code of codes) {
      for (const card of this.byPhonetic.get(code) ?? []) {
        const key = card.oracleId.toString();
        if (seen.has(key)) {
          continue;
        }
        seen.add(key);
        matches.push(card);
      }
    }
    return matches;
  }

  all(): readonly CatalogName[] {
    return this.cards;
  }
}
