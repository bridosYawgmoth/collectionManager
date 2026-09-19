import { compactNormalized, normalizedNameSimilarity } from "./levenshtein.js";

function extractTrigrams(value: string): Set<string> {
  const padded = `  ${value} `;
  const grams = new Set<string>();
  for (let index = 0; index <= padded.length - 3; index += 1) {
    grams.add(padded.slice(index, index + 3));
  }
  return grams;
}

// trigramSimilarity: Jaccard on character trigrams, same idea as pg_trgm.
// Domain ranking uses this so identity is decided in TypeScript even when
// Postgres only prefilters. Without it, SQL similarity would become the
// identity function and the fixture suite could not run offline.
export function trigramSimilarity(left: string, right: string): number {
  if (left === right) {
    return 1;
  }
  if (left.length === 0 || right.length === 0) {
    return 0;
  }
  const leftGrams = extractTrigrams(left);
  const rightGrams = extractTrigrams(right);
  let shared = 0;
  for (const gram of leftGrams) {
    if (rightGrams.has(gram)) {
      shared += 1;
    }
  }
  const union = leftGrams.size + rightGrams.size - shared;
  if (union === 0) {
    return 0;
  }
  return shared / union;
}

export function fuzzyNameScore(spoken: string, catalog: string): number {
  const trigram = Math.max(
    trigramSimilarity(spoken, catalog),
    trigramSimilarity(compactNormalized(spoken), compactNormalized(catalog)),
  );
  const lev = normalizedNameSimilarity(spoken, catalog);
  return 0.6 * trigram + 0.4 * lev;
}
