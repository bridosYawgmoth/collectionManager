import type { CatalogName } from "./catalog-name.js";

export interface FindSimilarNames {
  normalized: string;
  limit: number;
}

// TrigramCandidateSource: coarse similar-name lookup (in-memory or pg_trgm).
// Domain ranking still decides identity. Without it, SQL similarity would
// leak into CardResolver and the fixture suite could not stay I/O-free.
export interface TrigramCandidateSource {
  findSimilar(options: FindSimilarNames): Promise<readonly CatalogName[]>;
}
