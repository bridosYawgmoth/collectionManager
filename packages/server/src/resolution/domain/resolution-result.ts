import type { CatalogName } from "./catalog-name.js";

export type ResolutionStage = "exact" | "alias" | "phonetic" | "trigram";

export interface RankedCandidate {
  readonly card: CatalogName;
  readonly score: number;
  readonly stage: ResolutionStage;
}

export type ResolutionResult =
  | {
      readonly status: "matched";
      readonly winner: RankedCandidate;
      readonly alternatives: readonly RankedCandidate[];
    }
  | {
      readonly status: "ambiguous";
      readonly candidates: readonly RankedCandidate[];
    }
  | {
      readonly status: "unresolved";
      readonly candidates: readonly RankedCandidate[];
    };
