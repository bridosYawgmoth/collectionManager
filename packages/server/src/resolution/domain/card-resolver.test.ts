import { describe, expect, it } from "vitest";
import { OracleId } from "../../catalog/domain/oracle-id.js";
import { catalogNameFrom } from "./catalog-name.js";
import { CardResolver } from "./card-resolver.js";
import { InMemoryCardNameIndex } from "./in-memory-card-name-index.js";

const BOLT = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1";
const AETHERIZE = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2";
const GOYF = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3";
const FOW = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa4";
const JOTUN = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa6";
const AUTHORIZE = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa7";
const BLAST = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa8";
const CONFIDANT = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa9";
const LIMDUL = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa10";
const SWORDS = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa11";

function catalog() {
  return new InMemoryCardNameIndex([
    catalogNameFrom({ oracleId: OracleId.from(BOLT), name: "Lightning Bolt" }),
    catalogNameFrom({ oracleId: OracleId.from(AETHERIZE), name: "Ætherize" }),
    catalogNameFrom({ oracleId: OracleId.from(GOYF), name: "Tarmogoyf" }),
    catalogNameFrom({ oracleId: OracleId.from(FOW), name: "Force of Will" }),
    catalogNameFrom({ oracleId: OracleId.from(JOTUN), name: "Jötun Grunt" }),
    catalogNameFrom({ oracleId: OracleId.from(AUTHORIZE), name: "Authorize" }),
    catalogNameFrom({ oracleId: OracleId.from(BLAST), name: "Lightning Blast" }),
    catalogNameFrom({ oracleId: OracleId.from(CONFIDANT), name: "Dark Confidant" }),
    catalogNameFrom({ oracleId: OracleId.from(LIMDUL), name: "Lim-Dûl's Vault" }),
    catalogNameFrom({ oracleId: OracleId.from(SWORDS), name: "Swords to Plowshares" }),
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
    expect(result.candidates.every((candidate) => candidate.score < 0.55)).toBe(true);
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

  it("resolves a phonetically mangled name to the correct card", () => {
    const resolver = new CardResolver(catalog());

    const aetherize = resolver.match("ether eyes");
    expect(aetherize.status).toBe("matched");
    if (aetherize.status !== "matched") {
      return;
    }
    expect(aetherize.winner.card.name).toBe("Ætherize");
    expect(aetherize.winner.stage).toBe("phonetic");

    const jotun = resolver.match("yoten grunt");
    expect(jotun.status).toBe("matched");
    if (jotun.status !== "matched") {
      return;
    }
    expect(jotun.winner.card.name).toBe("Jötun Grunt");
    expect(jotun.winner.stage).toBe("phonetic");

    const bob = resolver.match("dark confident");
    expect(bob.status).toBe("matched");
    if (bob.status !== "matched") {
      return;
    }
    expect(bob.winner.card.name).toBe("Dark Confidant");
    expect(bob.winner.stage).toBe("phonetic");
  });

  it("does not treat a different lightning variant as a phonetic hit for bolt", () => {
    const resolver = new CardResolver(catalog());
    const result = resolver.match("lightning bolt");

    expect(result.status).toBe("matched");
    if (result.status !== "matched") {
      return;
    }
    expect(result.winner.card.name).toBe("Lightning Bolt");
    expect(result.winner.stage).toBe("exact");
  });

  it("ranks a remaining candidate with trigram and edit distance when sound codes miss", () => {
    const resolver = new CardResolver(catalog());

    const vault = resolver.match("limb duals vault");
    expect(vault.status).toBe("matched");
    if (vault.status !== "matched") {
      return;
    }
    expect(vault.winner.card.name).toBe("Lim-Dûl's Vault");
    expect(vault.winner.stage).toBe("trigram");

    const swords = resolver.match("swords to plough shares");
    expect(swords.status).toBe("matched");
    if (swords.status !== "matched") {
      return;
    }
    expect(swords.winner.card.name).toBe("Swords to Plowshares");
    expect(swords.winner.stage).toBe("trigram");
  });

  it("treats a low-scoring leftover as unresolved rather than guessing", () => {
    const resolver = new CardResolver(catalog());
    const result = resolver.match("xyzzy not a real card");

    expect(result.status).toBe("unresolved");
  });

  it("returns ambiguous when the top two fuzzy scores are too close", () => {
    const resolver = new CardResolver(
      new InMemoryCardNameIndex(
        [
          catalogNameFrom({ oracleId: OracleId.from(BOLT), name: "Lightning Bolt" }),
          catalogNameFrom({ oracleId: OracleId.from(BLAST), name: "Lightning Blast" }),
        ],
        [],
      ),
    );

    const result = resolver.match("lightning");
    expect(result.status).toBe("ambiguous");
    if (result.status !== "ambiguous") {
      return;
    }
    expect(result.candidates.map((candidate) => candidate.card.name)).toEqual(
      expect.arrayContaining(["Lightning Bolt", "Lightning Blast"]),
    );
  });
});
