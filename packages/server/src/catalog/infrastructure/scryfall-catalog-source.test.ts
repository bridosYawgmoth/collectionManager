import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { ScryfallBulkClient } from "./scryfall-bulk-client.js";
import { ScryfallCatalogSource } from "./scryfall-catalog-source.js";

const fixtures = resolve(import.meta.dirname, "__fixtures__");
const USER_AGENT = "collectionManager-test/0.1 (tests)";

describe("ScryfallCatalogSource", () => {
  const tempDirs: string[] = [];

  afterEach(async () => {
    await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
  });

  it("downloads oracle_cards then default_cards into the data dir and parses them", async () => {
    const dataDir = await mkdtemp(join(tmpdir(), "scryfall-source-"));
    tempDirs.push(dataDir);
    const sleeps: number[] = [];
    const oracleBody = await readFile(resolve(fixtures, "oracle-cards.json"), "utf8");
    const defaultBody = await readFile(resolve(fixtures, "default-cards.json"), "utf8");

    const client = new ScryfallBulkClient({
      userAgent: USER_AGENT,
      fetchImpl: (input) => {
        const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
        if (url.includes("bulk-data")) {
          return Promise.resolve(
            new Response(
              JSON.stringify({
                data: [
                  {
                    type: "oracle_cards",
                    download_uri: "https://data.scryfall.io/oracle-cards/oracle-cards-test.json",
                    updated_at: "2026-09-19T00:00:00.000Z",
                  },
                  {
                    type: "default_cards",
                    download_uri: "https://data.scryfall.io/default-cards/default-cards-test.json",
                    updated_at: "2026-09-19T00:00:00.000Z",
                  },
                ],
              }),
              { status: 200 },
            ),
          );
        }
        if (url.includes("oracle-cards")) {
          return Promise.resolve(new Response(oracleBody, { status: 200 }));
        }
        if (url.includes("default-cards")) {
          return Promise.resolve(new Response(defaultBody, { status: 200 }));
        }
        return Promise.reject(new Error(`unexpected url ${url}`));
      },
      sleep: () => Promise.resolve(),
    });

    const source = new ScryfallCatalogSource({
      client,
      dataDir,
      sleep: (ms) => {
        sleeps.push(ms);
        return Promise.resolve();
      },
    });

    const loaded = await source.load();

    expect(loaded.cards).toHaveLength(1);
    expect(loaded.cards[0]?.name).toBe("Ætherize");
    expect(loaded.printings).toHaveLength(2);
    expect(loaded.skippedCards).toBe(1);
    expect(sleeps).toEqual([100]);
    expect(await readFile(join(dataDir, "oracle_cards.json"), "utf8")).toBe(oracleBody);
    expect(await readFile(join(dataDir, "default_cards.json"), "utf8")).toBe(defaultBody);
  });
});
