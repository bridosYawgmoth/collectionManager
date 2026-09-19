import type { CatalogName } from "./catalog-name.js";

// CardNameIndex: lets CardResolver query names without Postgres. Without
// it the mangled-transcript fixture suite cannot run as a pure unit test.
export interface CardNameIndex {
  findExact(normalized: string): CatalogName | undefined;
  findAlias(normalized: string): CatalogName | undefined;
  findPhonetic(codes: readonly string[]): readonly CatalogName[];
  all(): readonly CatalogName[];
}
