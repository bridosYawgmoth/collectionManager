import { normalizeCardName } from "../../catalog/domain/normalize-card-name.js";
import type { OracleId } from "../../catalog/domain/oracle-id.js";

// CatalogName: the resolver's slice of a card — oracle identity and the
// printed/normalized names it matches on. Without it, resolution would
// drag printing, prices, and oracle text into a pure name match.
export interface CatalogName {
  readonly oracleId: OracleId;
  readonly name: string;
  readonly nameNormalized: string;
}

export function catalogNameFrom(options: { oracleId: OracleId; name: string }): CatalogName {
  const name = options.name.trim();
  if (name === "") {
    throw new Error("Catalog name is required");
  }
  return {
    oracleId: options.oracleId,
    name,
    nameNormalized: normalizeCardName(name),
  };
}
