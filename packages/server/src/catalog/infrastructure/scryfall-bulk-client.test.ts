import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  SCRYFALL_BULK_DATA_URL,
  ScryfallBulkClient,
  ScryfallHttpError,
} from "./scryfall-bulk-client.js";

const USER_AGENT = "collectionManager/0.1 (https://github.com/bridosYawgmoth/collectionManager)";
const ORACLE_URI = "https://data.scryfall.io/oracle-cards/oracle-cards-test.json";
const DEFAULT_URI = "https://data.scryfall.io/default-cards/default-cards-test.json";

const bulkList = {
  data: [
    { type: "oracle_cards", download_uri: ORACLE_URI, updated_at: "2026-09-19T00:00:00.000Z" },
    { type: "default_cards", download_uri: DEFAULT_URI, updated_at: "2026-09-19T00:00:00.000Z" },
  ],
};

interface RecordedRequest {
  url: string;
  headers: Record<string, string>;
}

function headerMap(headers: Headers): Record<string, string> {
  const mapped: Record<string, string> = {};
  headers.forEach((value, key) => {
    mapped[key.toLowerCase()] = value;
  });
  return mapped;
}

function requestUrl(input: Parameters<typeof fetch>[0]): string {
  if (typeof input === "string") {
    return input;
  }
  if (input instanceof URL) {
    return input.href;
  }
  return input.url;
}

const noopSleep = (): Promise<void> => Promise.resolve();

describe("ScryfallBulkClient", () => {
  const tempDirs: string[] = [];

  afterEach(async () => {
    await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
  });

  it("resolves bulk download URLs from the bulk-data index and sends identifying headers", async () => {
    const requests: RecordedRequest[] = [];
    const client = new ScryfallBulkClient({
      userAgent: USER_AGENT,
      fetchImpl: (input, init) => {
        const request = new Request(input, init);
        requests.push({ url: request.url, headers: headerMap(request.headers) });
        if (request.url === SCRYFALL_BULK_DATA_URL) {
          return Promise.resolve(new Response(JSON.stringify(bulkList), { status: 200 }));
        }
        if (request.url === ORACLE_URI) {
          return Promise.resolve(new Response('[{"id":"oracle"}]', { status: 200 }));
        }
        return Promise.reject(new Error(`unexpected url ${request.url}`));
      },
      sleep: noopSleep,
    });

    const dest = join(await tempDir(), "oracle_cards.json");
    await client.downloadBulkType({ type: "oracle_cards", destPath: dest });

    expect(requests.map((request) => request.url)).toEqual([SCRYFALL_BULK_DATA_URL, ORACLE_URI]);
    for (const request of requests) {
      expect(request.headers["user-agent"]).toBe(USER_AGENT);
      expect(request.headers["accept"]).toBe("application/json");
    }
    expect(await readFile(dest, "utf8")).toBe('[{"id":"oracle"}]');
  });

  it("retries a 429 using Retry-After and then succeeds", async () => {
    let downloadCalls = 0;
    const sleeps: number[] = [];
    const client = new ScryfallBulkClient({
      userAgent: USER_AGENT,
      fetchImpl: (input) => {
        const url = requestUrl(input);
        if (url === SCRYFALL_BULK_DATA_URL) {
          return Promise.resolve(new Response(JSON.stringify(bulkList), { status: 200 }));
        }
        downloadCalls += 1;
        if (downloadCalls === 1) {
          return Promise.resolve(
            new Response("slow down", { status: 429, headers: { "Retry-After": "0" } }),
          );
        }
        return Promise.resolve(new Response("[]", { status: 200 }));
      },
      sleep: (ms) => {
        sleeps.push(ms);
        return Promise.resolve();
      },
    });

    await client.downloadBulkType({
      type: "default_cards",
      destPath: join(await tempDir(), "default_cards.json"),
    });

    expect(downloadCalls).toBe(2);
    expect(sleeps).toContain(0);
  });

  it("does not retry a 404", async () => {
    let calls = 0;
    const client = new ScryfallBulkClient({
      userAgent: USER_AGENT,
      fetchImpl: () => {
        calls += 1;
        return Promise.resolve(new Response("missing", { status: 404 }));
      },
      sleep: noopSleep,
    });

    await expect(
      client.downloadBulkType({
        type: "oracle_cards",
        destPath: join(await tempDir(), "oracle_cards.json"),
      }),
    ).rejects.toSatisfy(
      (error: unknown) => error instanceof ScryfallHttpError && error.status === 404,
    );
    expect(calls).toBe(1);
  });

  it("retries a 503 then fails after the attempt budget", async () => {
    let calls = 0;
    const client = new ScryfallBulkClient({
      userAgent: USER_AGENT,
      maxAttempts: 3,
      fetchImpl: () => {
        calls += 1;
        return Promise.resolve(new Response("down", { status: 503 }));
      },
      sleep: noopSleep,
    });

    await expect(
      client.downloadBulkType({
        type: "oracle_cards",
        destPath: join(await tempDir(), "oracle_cards.json"),
      }),
    ).rejects.toSatisfy(
      (error: unknown) => error instanceof ScryfallHttpError && error.status === 503,
    );
    expect(calls).toBe(3);
  });

  it("fails when the bulk-data index omits the requested type", async () => {
    const client = new ScryfallBulkClient({
      userAgent: USER_AGENT,
      fetchImpl: () => Promise.resolve(new Response(JSON.stringify({ data: [] }), { status: 200 })),
      sleep: noopSleep,
    });

    await expect(
      client.downloadBulkType({
        type: "oracle_cards",
        destPath: join(await tempDir(), "oracle_cards.json"),
      }),
    ).rejects.toThrow(/oracle_cards/);
  });

  async function tempDir(): Promise<string> {
    const dir = await mkdtemp(join(tmpdir(), "scryfall-bulk-"));
    tempDirs.push(dir);
    return dir;
  }
});
