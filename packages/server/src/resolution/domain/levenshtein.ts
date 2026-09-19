export function levenshtein(left: string, right: string): number {
  if (left === right) {
    return 0;
  }
  if (left.length === 0) {
    return right.length;
  }
  if (right.length === 0) {
    return left.length;
  }

  const distances: number[] = [];
  for (let j = 0; j <= right.length; j += 1) {
    distances.push(j);
  }

  for (let i = 1; i <= left.length; i += 1) {
    let previousDiagonal = distances[0] ?? 0;
    distances[0] = i;
    for (let j = 1; j <= right.length; j += 1) {
      const current = distances[j] ?? 0;
      const substitution = left[i - 1] === right[j - 1] ? 0 : 1;
      const deletion = current + 1;
      const insertion = (distances[j - 1] ?? 0) + 1;
      const swap = previousDiagonal + substitution;
      distances[j] = Math.min(deletion, insertion, swap);
      previousDiagonal = current;
    }
  }

  return distances[right.length] ?? 0;
}

export function levenshteinSimilarity(left: string, right: string): number {
  const maxLen = Math.max(left.length, right.length);
  if (maxLen === 0) {
    return 1;
  }
  return 1 - levenshtein(left, right) / maxLen;
}

export function compactNormalized(normalized: string): string {
  return normalized.replace(/ /g, "");
}

// normalizedNameSimilarity: best of spaced vs space-stripped Levenshtein.
// STT often inserts or drops spaces ("snap caster mage"). Without the compact
// form those would look farther than they sound.
export function normalizedNameSimilarity(spoken: string, catalog: string): number {
  return Math.max(
    levenshteinSimilarity(spoken, catalog),
    levenshteinSimilarity(compactNormalized(spoken), compactNormalized(catalog)),
  );
}
