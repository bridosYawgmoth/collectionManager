import { describe, expect, it } from "vitest";
import { OracleId } from "../../catalog/domain/oracle-id.js";
import { catalogNameFrom } from "../domain/catalog-name.js";
import { CardResolver } from "../domain/card-resolver.js";
import { InMemoryCardNameIndex } from "../domain/in-memory-card-name-index.js";
import type { CatalogName } from "../domain/catalog-name.js";
import type { TrigramCandidateSource } from "../domain/trigram-candidate-source.js";
import { ResolveSpokenName } from "./resolve-spoken-name.js";

const BOLT = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1";
const LIMDUL = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa10";

function vault(): CatalogName {
  return catalogNameFrom({ oracleId: OracleId.from(LIMDUL), name: "Lim-Dûl's Vault" });
}

function bolt(): CatalogName {
  return catalogNameFrom({ oracleId: OracleId.from(BOLT), name: "Lightning Bolt" });
}

function resolver(): CardResolver {
  return new CardResolver(new InMemoryCardNameIndex([vault(), bolt()]));
}

describe("ResolveSpokenName", () => {
  it("still resolves exact names without a SQL prefilter", async () => {
    const useCase = new ResolveSpokenName({ resolver: resolver() });
    const result = await useCase.execute("lightning bolt");
    expect(result.status).toBe("matched");
    if (result.status !== "matched") {
      return;
    }
    expect(result.winner.stage).toBe("exact");
  });

  it("ranks only the SQL prefilter subset so a missing candidate stays unresolved", async () => {
    const empty: TrigramCandidateSource = {
      findSimilar: () => Promise.resolve([]),
    };
    const useCase = new ResolveSpokenName({ resolver: resolver(), trigramSource: empty });
    const result = await useCase.execute("limb duals vault");

    expect(resolver().match("limb duals vault").status).toBe("matched");
    expect(result.status).toBe("unresolved");
  });

  it("identifies a trigram hit from a prefiltered candidate set", async () => {
    const source: TrigramCandidateSource = {
      findSimilar: () => Promise.resolve([vault()]),
    };
    const useCase = new ResolveSpokenName({ resolver: resolver(), trigramSource: source });
    const result = await useCase.execute("limb duals vault");

    expect(result.status).toBe("matched");
    if (result.status !== "matched") {
      return;
    }
    expect(result.winner.card.name).toBe("Lim-Dûl's Vault");
    expect(result.winner.stage).toBe("trigram");
  });
});
