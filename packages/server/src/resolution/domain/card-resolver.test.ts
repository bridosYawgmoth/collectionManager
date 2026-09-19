import { describe, expect, it } from "vitest";
import { OracleId } from "../../catalog/domain/oracle-id.js";
import { catalogNameFrom } from "./catalog-name.js";
import { CardResolver } from "./card-resolver.js";
import { InMemoryCardNameIndex } from "./in-memory-card-name-index.js";

const BOLT = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1";
const AETHERIZE = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2";

function catalog() {
  return new InMemoryCardNameIndex([
    catalogNameFrom({ oracleId: OracleId.from(BOLT), name: "Lightning Bolt" }),
    catalogNameFrom({ oracleId: OracleId.from(AETHERIZE), name: "Ætherize" }),
  ]);
}

describe("CardResolver", () => {
  it("returns no candidates when the transcript is empty", () => {
    const resolver = new CardResolver(catalog());

    expect(resolver.match("").status).toBe("unresolved");
    expect(resolver.match("   ").status).toBe("unresolved");
    expect(resolver.match("...").status).toBe("unresolved");
  });

  it("resolves a normalized spoken name to the exact catalog card", () => {
    const resolver = new CardResolver(catalog());

    const bolt = resolver.match("Lightning   Bolt");
    expect(bolt.status).toBe("matched");
    if (bolt.status !== "matched") {
      return;
    }
    expect(bolt.winner.card.name).toBe("Lightning Bolt");
    expect(bolt.winner.stage).toBe("exact");
    expect(bolt.winner.score).toBe(1);

    const aetherize = resolver.match("aetherize");
    expect(aetherize.status).toBe("matched");
    if (aetherize.status !== "matched") {
      return;
    }
    expect(aetherize.winner.card.name).toBe("Ætherize");
    expect(aetherize.winner.stage).toBe("exact");
  });

  it("returns unresolved when no catalog name matches the spoken string", () => {
    const resolver = new CardResolver(catalog());
    const result = resolver.match("sol ring");

    expect(result.status).toBe("unresolved");
    if (result.status !== "unresolved") {
      return;
    }
    expect(result.candidates).toEqual([]);
  });
});
