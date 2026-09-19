import { normalizeCardName } from "../../catalog/domain/normalize-card-name.js";
import type { CatalogName } from "./catalog-name.js";
import type { CardNameIndex } from "./card-name-index.js";
import { normalizedNameSimilarity } from "./levenshtein.js";
import { phoneticCodes } from "./phonetic-code.js";
import type { RankedCandidate, ResolutionResult, ResolutionStage } from "./resolution-result.js";
import { fuzzyNameScore } from "./trigram.js";

// Unique Double Metaphone hits are high-confidence even when Levenshtein is
// modest: STT preserves sound, not spelling. Colliding codes are ranked by
// edit similarity; a small gap stays ambiguous rather than silently wrong.
const PHONETIC_UNIQUE_SCORE = 0.92;
const PHONETIC_RANKED_SCORE = 0.85;
const PHONETIC_GAP = 0.08;

// Trigram is the last local step. Below TRIGRAM_MATCH_MIN, or when the top
// two scores are within TRIGRAM_GAP, the result stays pending confirmation
// and must not mutate Collection. LLM tiebreak is out of scope.
const TRIGRAM_MATCH_MIN = 0.55;
const TRIGRAM_GAP = 0.08;
const TRIGRAM_CANDIDATE_LIMIT = 5;

// CardResolver: spoken string → ranked catalog identity. Pure: scoring
// never touches SQL or a model. Without it, card identity would leak into
// intent extraction and hallucination would decide what the user owns.
export class CardResolver {
  constructor(private readonly index: CardNameIndex) {}

  match(spoken: string): ResolutionResult {
    const early = this.matchThroughPhonetic(spoken);
    if (early !== undefined) {
      return early;
    }
    return this.rankTrigram(spoken, this.index.all());
  }

  // matchThroughPhonetic: stops before trigram so an application use case can
  // swap in a SQL pg_trgm candidate set. Undefined means fall through.
  matchThroughPhonetic(spoken: string): ResolutionResult | undefined {
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

    return this.matchPhonetic(normalized);
  }

  // rankTrigram: scores a prefiltered candidate set in TypeScript. Buys a
  // SQL pg_trgm prefilter without letting Postgres decide identity.
  rankTrigram(spokenOrNormalized: string, candidates: readonly CatalogName[]): ResolutionResult {
    const normalized = normalizeCardName(spokenOrNormalized);
    if (normalized === "" || candidates.length === 0) {
      return { status: "unresolved", candidates: [] };
    }
    return this.decideTrigram(normalized, candidates);
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

    const ranked = rankBy(normalized, hits, "phonetic", normalizedNameSimilarity);
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

  private decideTrigram(
    normalized: string,
    candidates: readonly CatalogName[],
  ): ResolutionResult {
    const ranked = rankBy(normalized, candidates, "trigram", fuzzyNameScore).slice(
      0,
      TRIGRAM_CANDIDATE_LIMIT,
    );
    const best = ranked[0];
    const second = ranked[1];
    if (best === undefined || best.score < TRIGRAM_MATCH_MIN) {
      return { status: "unresolved", candidates: ranked };
    }
    if (second !== undefined && best.score - second.score < TRIGRAM_GAP) {
      return { status: "ambiguous", candidates: ranked };
    }
    return {
      status: "matched",
      winner: best,
      alternatives: ranked.slice(1),
    };
  }
}

function rankBy(
  spoken: string,
  cards: readonly CatalogName[],
  stage: ResolutionStage,
  score: (spoken: string, catalog: string) => number,
): RankedCandidate[] {
  return cards
    .map((card) => ({
      card,
      score: score(spoken, card.nameNormalized),
      stage,
    }))
    .sort((left, right) => right.score - left.score);
}
