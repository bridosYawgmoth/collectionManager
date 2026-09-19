import { normalizeCardName } from "../../catalog/domain/normalize-card-name.js";
import type { CatalogName } from "./catalog-name.js";
import type { CardNameIndex } from "./card-name-index.js";
import { normalizedNameSimilarity } from "./levenshtein.js";
import { phoneticCodes } from "./phonetic-code.js";
import type { RankedCandidate, ResolutionResult } from "./resolution-result.js";

// Unique Double Metaphone hits are high-confidence even when Levenshtein is
// modest: STT preserves sound, not spelling. Colliding codes are ranked by
// edit similarity; a small gap stays ambiguous rather than silently wrong.
const PHONETIC_UNIQUE_SCORE = 0.92;
const PHONETIC_RANKED_SCORE = 0.85;
const PHONETIC_GAP = 0.08;

// CardResolver: spoken string → ranked catalog identity. Pure: scoring
// never touches SQL or a model. Without it, card identity would leak into
// intent extraction and hallucination would decide what the user owns.
export class CardResolver {
  constructor(private readonly index: CardNameIndex) {}

  match(spoken: string): ResolutionResult {
    const normalized = normalizeCardName(spoken);
    if (normalized === "") {
      return { status: "unresolved", candidates: [] };
    }

    const exact = this.index.findExact(normalized);
    if (exact !== undefined) {
      return {
        status: "matched",
        winner: { card: exact, score: 1, stage: "exact" },
        alternatives: [],
      };
    }

    const alias = this.index.findAlias(normalized);
    if (alias !== undefined) {
      return {
        status: "matched",
        winner: { card: alias, score: 1, stage: "alias" },
        alternatives: [],
      };
    }

    const phonetic = this.matchPhonetic(normalized);
    if (phonetic !== undefined) {
      return phonetic;
    }

    return { status: "unresolved", candidates: [] };
  }

  private matchPhonetic(normalized: string): ResolutionResult | undefined {
    const hits = this.index.findPhonetic(phoneticCodes(normalized));
    if (hits.length === 0) {
      return undefined;
    }
    if (hits.length === 1) {
      const card = hits[0];
      if (card === undefined) {
        return undefined;
      }
      return {
        status: "matched",
        winner: { card, score: PHONETIC_UNIQUE_SCORE, stage: "phonetic" },
        alternatives: [],
      };
    }

    const ranked = rankBySimilarity(normalized, hits, "phonetic");
    const best = ranked[0];
    const second = ranked[1];
    if (best === undefined) {
      return undefined;
    }
    if (second === undefined || best.score - second.score >= PHONETIC_GAP) {
      return {
        status: "matched",
        winner: { ...best, score: PHONETIC_RANKED_SCORE },
        alternatives: ranked.slice(1),
      };
    }
    return { status: "ambiguous", candidates: ranked };
  }
}

function rankBySimilarity(
  spoken: string,
  cards: readonly CatalogName[],
  stage: "phonetic",
): RankedCandidate[] {
  return cards
    .map((card) => ({
      card,
      score: normalizedNameSimilarity(spoken, card.nameNormalized),
      stage,
    }))
    .sort((left, right) => right.score - left.score);
}
