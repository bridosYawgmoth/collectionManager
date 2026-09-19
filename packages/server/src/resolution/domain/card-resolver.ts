import { normalizeCardName } from "../../catalog/domain/normalize-card-name.js";
import type { CardNameIndex } from "./card-name-index.js";
import type { ResolutionResult } from "./resolution-result.js";

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

    return { status: "unresolved", candidates: [] };
  }
}
