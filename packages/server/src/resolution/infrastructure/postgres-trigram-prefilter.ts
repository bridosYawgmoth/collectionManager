import { OracleId } from "../../catalog/domain/oracle-id.js";
import type { SqlClient } from "../../platform/db.js";
import { catalogNameFrom } from "../domain/catalog-name.js";
import type { CatalogName } from "../domain/catalog-name.js";
import { compactNormalized } from "../domain/levenshtein.js";
import type {
  FindSimilarNames,
  TrigramCandidateSource,
} from "../domain/trigram-candidate-source.js";

interface SimilarNameRow {
  oracle_id: string;
  name: string;
}

// PostgresTrigramPrefilter: pg_trgm GIN as a coarse candidate list. Scoring
// stays in TypeScript. Without it, a trigram stage would sequential-scan
// ~38k names in process memory or let SQL similarity decide identity.
export class PostgresTrigramPrefilter implements TrigramCandidateSource {
  constructor(private readonly sql: SqlClient) {}

  async findSimilar(options: FindSimilarNames): Promise<readonly CatalogName[]> {
    if (options.normalized === "" || options.limit <= 0) {
      return [];
    }
    const compact = compactNormalized(options.normalized);
    const rows = await this.sql<SimilarNameRow[]>`
      SELECT oracle_id, name
      FROM cards
      WHERE name_normalized % ${options.normalized}
         OR name_normalized % ${compact}
      ORDER BY GREATEST(
        similarity(name_normalized, ${options.normalized}),
        similarity(name_normalized, ${compact})
      ) DESC
      LIMIT ${options.limit}
    `;
    return rows.map((row) =>
      catalogNameFrom({ oracleId: OracleId.from(row.oracle_id), name: row.name }),
    );
  }
}
