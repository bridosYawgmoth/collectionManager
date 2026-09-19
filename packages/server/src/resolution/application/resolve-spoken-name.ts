import { normalizeCardName } from "../../catalog/domain/normalize-card-name.js";
import { CardResolver } from "../domain/card-resolver.js";
import type { ResolutionResult } from "../domain/resolution-result.js";
import type { TrigramCandidateSource } from "../domain/trigram-candidate-source.js";

const DEFAULT_PREFILTER_LIMIT = 25;

export interface ResolveSpokenNameOptions {
  resolver: CardResolver;
  trigramSource?: TrigramCandidateSource;
  prefilterLimit?: number;
}

// ResolveSpokenName: runs the local cascade, then optionally a SQL trigram
// prefilter before TypeScript ranking. Buys keeping CardResolver free of I/O.
// Without it, HTTP and eval would each wire pg_trgm into the cascade.
export class ResolveSpokenName {
  private readonly resolver: CardResolver;
  private readonly trigramSource: TrigramCandidateSource | undefined;
  private readonly prefilterLimit: number;

  constructor(options: ResolveSpokenNameOptions) {
    this.resolver = options.resolver;
    this.trigramSource = options.trigramSource;
    this.prefilterLimit = options.prefilterLimit ?? DEFAULT_PREFILTER_LIMIT;
  }

  async execute(spoken: string): Promise<ResolutionResult> {
    if (this.trigramSource === undefined) {
      return this.resolver.match(spoken);
    }

    const early = this.resolver.matchThroughPhonetic(spoken);
    if (early !== undefined) {
      return early;
    }

    const normalized = normalizeCardName(spoken);
    const candidates = await this.trigramSource.findSimilar({
      normalized,
      limit: this.prefilterLimit,
    });
    return this.resolver.rankTrigram(normalized, candidates);
  }
}
