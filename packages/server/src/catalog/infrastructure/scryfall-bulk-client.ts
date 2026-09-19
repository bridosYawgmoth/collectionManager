import { createWriteStream } from "node:fs";
import { mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import type { ReadableStream as NodeWebReadableStream } from "node:stream/web";
import { createGunzip } from "node:zlib";
import { z } from "zod";

export const SCRYFALL_BULK_DATA_URL = "https://api.scryfall.com/bulk-data";

const bulkDataItemSchema = z.object({
  type: z.string(),
  download_uri: z.string().optional(),
  jsonl_download_uri: z.string().optional(),
  updated_at: z.string(),
});

const bulkDataListSchema = z.object({
  data: z.array(bulkDataItemSchema),
});

export interface ScryfallBulkClientOptions {
  userAgent: string;
  fetchImpl?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
  maxAttempts?: number;
}

export interface DownloadBulkTypeOptions {
  type: string;
  destPath: string;
}

export class ScryfallHttpError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "ScryfallHttpError";
  }
}

export class ScryfallBulkClient {
  private readonly userAgent: string;
  private readonly fetchImpl: typeof fetch;
  private readonly sleep: (ms: number) => Promise<void>;
  private readonly maxAttempts: number;

  constructor(options: ScryfallBulkClientOptions) {
    this.userAgent = options.userAgent;
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.sleep = options.sleep ?? defaultSleep;
    this.maxAttempts = options.maxAttempts ?? 3;
  }

  async downloadBulkType(options: DownloadBulkTypeOptions): Promise<void> {
    const downloadUri = await this.downloadUriFor(options.type);
    await mkdir(dirname(options.destPath), { recursive: true });
    await this.downloadFile(downloadUri, options.destPath);
  }

  private async downloadUriFor(type: string): Promise<string> {
    const body = await this.getText(SCRYFALL_BULK_DATA_URL);
    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(body) as unknown;
    } catch (error) {
      throw new BulkIndexError("Scryfall bulk-data response was not JSON", { cause: error });
    }
    const parsed = bulkDataListSchema.safeParse(parsedJson);
    if (!parsed.success) {
      throw new BulkIndexError("Scryfall bulk-data response did not match the expected shape");
    }
    const item = parsed.data.data.find((entry) => entry.type === type);
    if (item === undefined) {
      throw new BulkIndexError(`Scryfall bulk-data index does not include ${type}`);
    }
    // Live Scryfall only publishes jsonl_download_uri (.jsonl.gz). download_uri
    // is a fallback for uncompressed JSON fixtures. Without jsonl, refresh cannot start.
    const downloadUri = item.jsonl_download_uri ?? item.download_uri;
    if (downloadUri === undefined) {
      throw new BulkIndexError(`Scryfall bulk-data index does not include a download URI for ${type}`);
    }
    return downloadUri;
  }

  private async getText(url: string): Promise<string> {
    const response = await this.fetchWithRetry(url);
    return await response.text();
  }

  // Stream to disk so a >512MB JSONL payload never hits Buffer.toString's
  // hard cap (ERR_STRING_TOO_LONG). In-memory gunzip of default_cards fails.
  private async downloadFile(url: string, destPath: string): Promise<void> {
    const response = await this.fetchWithRetry(url);
    if (response.body === null) {
      throw new ScryfallHttpError(`Scryfall response had no body for ${url}`, response.status);
    }
    const source = Readable.fromWeb(response.body as NodeWebReadableStream<Uint8Array>);
    if (shouldGunzip(url, response)) {
      await pipeline(source, createGunzip(), createWriteStream(destPath));
      return;
    }
    await pipeline(source, createWriteStream(destPath));
  }

  private async fetchWithRetry(url: string): Promise<Response> {
    let lastError: ScryfallHttpError | undefined;
    for (let attempt = 1; attempt <= this.maxAttempts; attempt += 1) {
      const response = await this.fetchImpl(url, {
        headers: {
          "User-Agent": this.userAgent,
          Accept: "application/json",
        },
      });
      if (response.ok) {
        return response;
      }
      lastError = new ScryfallHttpError(
        `Scryfall request failed (${String(response.status)}) for ${url}`,
        response.status,
      );
      const retryable = response.status === 429 || response.status >= 500;
      if (!retryable || attempt === this.maxAttempts) {
        throw lastError;
      }
      await this.sleep(retryDelayMs(response, attempt));
    }
    throw lastError ?? new ScryfallHttpError(`Scryfall request failed for ${url}`, 0);
  }
}

export class BulkIndexError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "BulkIndexError";
  }
}

function shouldGunzip(url: string, response: Response): boolean {
  if (url.endsWith(".gz")) {
    return true;
  }
  const contentType = response.headers.get("content-type") ?? "";
  return contentType.includes("gzip");
}

function retryDelayMs(response: Response, attempt: number): number {
  const retryAfter = response.headers.get("Retry-After");
  if (retryAfter !== null && retryAfter !== "") {
    const seconds = Number.parseInt(retryAfter, 10);
    if (Number.isFinite(seconds) && seconds >= 0) {
      return seconds * 1000;
    }
  }
  return 1000 * 2 ** (attempt - 1);
}

async function defaultSleep(ms: number): Promise<void> {
  await new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });
}
