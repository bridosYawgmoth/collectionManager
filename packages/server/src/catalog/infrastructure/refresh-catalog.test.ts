import { describe, expect, it } from "vitest";
import { Card } from "../domain/card.js";
import type { CardCatalogPort, CatalogCounts } from "../domain/card-catalog-port.js";
import { CollectorNumber } from "../domain/collector-number.js";
import { OracleId } from "../domain/oracle-id.js";
import { Printing } from "../domain/printing.js";
import { ScryfallId } from "../domain/scryfall-id.js";
import { SetCode } from "../domain/set-code.js";
import { EmptyBulkError } from "./parse-scryfall-bulk.js";
import { refreshCatalog, type CatalogBulkSource } from "./refresh-catalog.js";

const ORACLE = OracleId.from("446c7d5c-8a1a-4b0e-9c3a-0a1b2c3d4e5f");
const OTHER_ORACLE = OracleId.from("66666666-7777-8888-9999-000000000000");

function aetherize(): Card {
  return Card.create({
    oracleId: ORACLE,
    name: "Ætherize",
    layout: "normal",
    typeLine: "Instant",
    manaCost: "{1}{U}",
    oracleText: "Return all attacking creatures to their owner's hand.",
    colorIdentity: ["U"],
    cmc: 2,
  });
}

function printing(options: { scryfallId: string; oracleId: OracleId; setCode: string }): Printing {
  return Printing.create({
    scryfallId: ScryfallId.from(options.scryfallId),
    oracleId: options.oracleId,
    setCode: SetCode.from(options.setCode),
    setName: options.setCode,
    collectorNumber: CollectorNumber.from("1"),
    rarity: "common",
    finishes: ["nonfoil"],
    lang: "en",
    imageUris: {},
    prices: {},
    releasedAt: "2013-02-01",
  });
}

class MemoryCatalog implements CardCatalogPort {
  cards = new Map<string, Card>();
  printings = new Map<string, Printing>();

  upsertCards(cards: readonly Card[]): Promise<void> {
    for (const card of cards) {
      this.cards.set(card.oracleId.toString(), card);
    }
    return Promise.resolve();
  }

  upsertPrintings(printings: readonly Printing[]): Promise<void> {
    for (const row of printings) {
      this.printings.set(row.scryfallId.toString(), row);
    }
    return Promise.resolve();
  }

  getCard(oracleId: OracleId): Promise<Card | null> {
    return Promise.resolve(this.cards.get(oracleId.toString()) ?? null);
  }

  getPrinting(scryfallId: ScryfallId): Promise<Printing | null> {
    return Promise.resolve(this.printings.get(scryfallId.toString()) ?? null);
  }

  counts(): Promise<CatalogCounts> {
    return Promise.resolve({ cards: this.cards.size, printings: this.printings.size });
  }

  setCodes(): Promise<readonly SetCode[]> {
    const codes = [...new Set([...this.printings.values()].map((row) => row.setCode.toString()))];
    codes.sort((left, right) => left.localeCompare(right));
    return Promise.resolve(codes.map((code) => SetCode.from(code)));
  }
}

describe("refreshCatalog", () => {
  it("upserts the bulk payload and reports count deltas and new set codes", async () => {
    const catalog = new MemoryCatalog();
    let reindexed = false;
    const source: CatalogBulkSource = {
      load: () =>
        Promise.resolve({
          cards: [aetherize()],
          printings: [
            printing({
              scryfallId: "e3285e6b-b12a-4e6a-8a1f-0f0c1b7a1111",
              oracleId: ORACLE,
              setCode: "gtc",
            }),
          ],
          skippedCards: 1,
          skippedPrintings: 0,
        }),
    };

    const report = await refreshCatalog({
      catalog,
      source,
      rebuildTrigramIndex: () => {
        reindexed = true;
        return Promise.resolve();
      },
    });

    expect(report).toEqual({
      cardsBefore: 0,
      cardsAfter: 1,
      printingsBefore: 0,
      printingsAfter: 1,
      newSetCodes: ["gtc"],
      skippedCards: 1,
      skippedPrintings: 0,
      trigramIndexRebuilt: true,
    });
    expect(reindexed).toBe(true);
    expect(catalog.cards.size).toBe(1);
  });

  it("drops printings whose oracle_id is not in the card bulk so counts never depend on a failed FK", async () => {
    const catalog = new MemoryCatalog();
    const report = await refreshCatalog({
      catalog,
      source: {
        load: () =>
          Promise.resolve({
            cards: [aetherize()],
            printings: [
              printing({
                scryfallId: "e3285e6b-b12a-4e6a-8a1f-0f0c1b7a1111",
                oracleId: ORACLE,
                setCode: "gtc",
              }),
              printing({
                scryfallId: "11111111-2222-3333-4444-555555555555",
                oracleId: OTHER_ORACLE,
                setCode: "isd",
              }),
            ],
            skippedCards: 0,
            skippedPrintings: 0,
          }),
      },
    });

    expect(report.printingsAfter).toBe(1);
    expect(report.skippedPrintings).toBe(1);
    expect(report.newSetCodes).toEqual(["gtc"]);
    expect(catalog.printings.size).toBe(1);
  });

  it("does not mutate the catalog when the bulk is empty", async () => {
    const catalog = new MemoryCatalog();
    await catalog.upsertCards([aetherize()]);

    await expect(
      refreshCatalog({
        catalog,
        source: {
          load: () => Promise.reject(new EmptyBulkError("Bulk file is empty: oracle_cards.json")),
        },
      }),
    ).rejects.toThrow(EmptyBulkError);

    expect(await catalog.counts()).toEqual({ cards: 1, printings: 0 });
  });
});
