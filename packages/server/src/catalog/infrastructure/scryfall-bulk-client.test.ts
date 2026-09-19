import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { gzipSync } from "node:zlib";
import { afterEach, describe, expect, it } from "vitest";
import {
  BulkIndexError,
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

  it("downloads gzipped JSONL when the index only exposes jsonl_download_uri", async () => {
    const jsonl = '{"id":"oracle"}\n{"id":"second"}\n';
    const gzipped = gzipSync(Buffer.from(jsonl));
    const jsonlUri = "https://data.scryfall.io/oracle-cards/oracle-cards-test.jsonl.gz";
    const requests: RecordedRequest[] = [];
    const client = new ScryfallBulkClient({
      userAgent: USER_AGENT,
      fetchImpl: (input, init) => {
        const request = new Request(input, init);
        requests.push({ url: request.url, headers: headerMap(request.headers) });
        if (request.url === SCRYFALL_BULK_DATA_URL) {
          return Promise.resolve(
            new Response(
              JSON.stringify({
                data: [
                  {
                    type: "oracle_cards",
                    jsonl_download_uri: jsonlUri,
                    updated_at: "2026-09-19T00:00:00.000Z",
                  },
                ],
              }),
              { status: 200 },
            ),
          );
        }
        if (request.url === jsonlUri) {
          return Promise.resolve(
            new Response(gzipped, {
              status: 200,
              headers: { "Content-Type": "application/gzip" },
            }),
          );
        }
        return Promise.reject(new Error(`unexpected url ${request.url}`));
      },
      sleep: noopSleep,
    });

    const dest = join(await tempDir(), "oracle_cards.json");
    await client.downloadBulkType({ type: "oracle_cards", destPath: dest });

    expect(requests.map((request) => request.url)).toEqual([SCRYFALL_BULK_DATA_URL, jsonlUri]);
    expect(await readFile(dest, "utf8")).toBe(jsonl);
  });

  it("prefers jsonl_download_uri over download_uri when both are present", async () => {
    const jsonl = '{"id":"from-jsonl"}\n';
    const gzipped = gzipSync(Buffer.from(jsonl));
    const jsonlUri = "https://data.scryfall.io/oracle-cards/oracle-cards-test.jsonl.gz";
    const requests: RecordedRequest[] = [];
    const client = new ScryfallBulkClient({
      userAgent: USER_AGENT,
      fetchImpl: (input, init) => {
        const request = new Request(input, init);
        requests.push({ url: request.url, headers: headerMap(request.headers) });
        if (request.url === SCRYFALL_BULK_DATA_URL) {
          return Promise.resolve(
            new Response(
              JSON.stringify({
                data: [
                  {
                    type: "oracle_cards",
                    download_uri: ORACLE_URI,
                    jsonl_download_uri: jsonlUri,
                    updated_at: "2026-09-19T00:00:00.000Z",
                  },
                ],
              }),
              { status: 200 },
            ),
          );
        }
        if (request.url === jsonlUri) {
          return Promise.resolve(new Response(gzipped, { status: 200 }));
        }
        return Promise.reject(new Error(`unexpected url ${request.url}`));
      },
      sleep: noopSleep,
    });

    await client.downloadBulkType({
      type: "oracle_cards",
      destPath: join(await tempDir(), "oracle_cards.json"),
    });

    expect(requests.map((request) => request.url)).toEqual([SCRYFALL_BULK_DATA_URL, jsonlUri]);
    expect(requests.map((request) => request.url)).not.toContain(ORACLE_URI);
  });

  it("fails when the bulk-data index is not JSON", async () => {
    const client = new ScryfallBulkClient({
      userAgent: USER_AGENT,
      fetchImpl: () => Promise.resolve(new Response("<html>nope</html>", { status: 200 })),
      sleep: noopSleep,
    });

    await expect(
      client.downloadBulkType({
        type: "oracle_cards",
        destPath: join(await tempDir(), "oracle_cards.json"),
      }),
    ).rejects.toThrow(BulkIndexError);
  });

  it("fails when the selected bulk item has neither download URI", async () => {
    const client = new ScryfallBulkClient({
      userAgent: USER_AGENT,
      fetchImpl: () =>
        Promise.resolve(
          new Response(
            JSON.stringify({
              data: [{ type: "oracle_cards", updated_at: "2026-09-19T00:00:00.000Z" }],
            }),
            { status: 200 },
          ),
        ),
      sleep: noopSleep,
    });

    await expect(
      client.downloadBulkType({
        type: "oracle_cards",
        destPath: join(await tempDir(), "oracle_cards.json"),
      }),
    ).rejects.toThrow(BulkIndexError);
  });

  it("decompresses an empty gzip payload to an empty dest file", async () => {
    const jsonlUri = "https://data.scryfall.io/oracle-cards/oracle-cards-empty.jsonl.gz";
    const client = new ScryfallBulkClient({
      userAgent: USER_AGENT,
      fetchImpl: (input) => {
        const url = requestUrl(input);
        if (url === SCRYFALL_BULK_DATA_URL) {
          return Promise.resolve(
            new Response(
              JSON.stringify({
                data: [
                  {
                    type: "oracle_cards",
                    jsonl_download_uri: jsonlUri,
                    updated_at: "2026-09-19T00:00:00.000Z",
                  },
                ],
              }),
              { status: 200 },
            ),
          );
        }
        if (url === jsonlUri) {
          return Promise.resolve(
            new Response(gzipSync(Buffer.from("")), {
              status: 200,
              headers: { "Content-Type": "application/gzip" },
            }),
          );
        }
        return Promise.reject(new Error(`unexpected url ${url}`));
      },
      sleep: noopSleep,
    });

    const dest = join(await tempDir(), "oracle_cards.json");
    await client.downloadBulkType({ type: "oracle_cards", destPath: dest });
    expect(await readFile(dest, "utf8")).toBe("");
  });

  async function tempDir(): Promise<string> {
    const dir = await mkdtemp(join(tmpdir(), "scryfall-bulk-"));
    tempDirs.push(dir);
    return dir;
  }
});
