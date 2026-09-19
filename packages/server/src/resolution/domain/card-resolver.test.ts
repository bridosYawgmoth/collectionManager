import { describe, expect, it } from "vitest";
import { OracleId } from "../../catalog/domain/oracle-id.js";
import { catalogNameFrom } from "./catalog-name.js";
import { CardResolver } from "./card-resolver.js";
import { InMemoryCardNameIndex } from "./in-memory-card-name-index.js";

const BOLT = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1";
const AETHERIZE = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2";
const GOYF = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3";
const FOW = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa4";

function catalog() {
  return new InMemoryCardNameIndex([
    catalogNameFrom({ oracleId: OracleId.from(BOLT), name: "Lightning Bolt" }),
    catalogNameFrom({ oracleId: OracleId.from(AETHERIZE), name: "Ætherize" }),
    catalogNameFrom({ oracleId: OracleId.from(GOYF), name: "Tarmogoyf" }),
    catalogNameFrom({ oracleId: OracleId.from(FOW), name: "Force of Will" }),
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

  it("resolves spoken slang through the alias table", () => {
    const resolver = new CardResolver(catalog());

    const bolt = resolver.match("bolt");
    expect(bolt.status).toBe("matched");
    if (bolt.status !== "matched") {
      return;
    }
    expect(bolt.winner.card.name).toBe("Lightning Bolt");
    expect(bolt.winner.stage).toBe("alias");
    expect(bolt.winner.score).toBe(1);

    const goyf = resolver.match("goyf");
    expect(goyf.status).toBe("matched");
    if (goyf.status !== "matched") {
      return;
    }
    expect(goyf.winner.card.name).toBe("Tarmogoyf");
    expect(goyf.winner.stage).toBe("alias");

    const fow = resolver.match("FOW");
    expect(fow.status).toBe("matched");
    if (fow.status !== "matched") {
      return;
    }
    expect(fow.winner.card.name).toBe("Force of Will");
    expect(fow.winner.stage).toBe("alias");
  });

  it("prefers a normalized exact match over an alias for the same spoken string", () => {
    const resolver = new CardResolver(
      new InMemoryCardNameIndex([
        catalogNameFrom({ oracleId: OracleId.from(BOLT), name: "Bolt" }),
        catalogNameFrom({
          oracleId: OracleId.from("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa5"),
          name: "Lightning Bolt",
        }),
      ]),
    );

    const result = resolver.match("bolt");
    expect(result.status).toBe("matched");
    if (result.status !== "matched") {
      return;
    }
    expect(result.winner.card.name).toBe("Bolt");
    expect(result.winner.stage).toBe("exact");
  });
});
