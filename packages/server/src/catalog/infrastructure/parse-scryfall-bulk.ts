import { createReadStream, type Stats } from "node:fs";
import { open, readFile, stat } from "node:fs/promises";
import { createInterface } from "node:readline";
import { z } from "zod";
import { Card } from "../domain/card.js";
import { CollectorNumber } from "../domain/collector-number.js";
import type { CreatePrintingOptions, ImageUris, PrintingPrices } from "../domain/printing.js";
import { Printing } from "../domain/printing.js";
import { OracleId } from "../domain/oracle-id.js";
import { ScryfallId } from "../domain/scryfall-id.js";
import { SetCode } from "../domain/set-code.js";

export class BulkParseError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "BulkParseError";
  }
}

export class EmptyBulkError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EmptyBulkError";
  }
}

export interface ParsedOracleCards {
  cards: Card[];
  skipped: number;
}

export interface ParsedDefaultCards {
  printings: Printing[];
  skipped: number;
}

const imageUrisSchema = z.object({
  small: z.string().optional(),
  normal: z.string().optional(),
  large: z.string().optional(),
  png: z.string().optional(),
  art_crop: z.string().optional(),
  border_crop: z.string().optional(),
});

const pricesSchema = z.object({
  usd: z.string().nullable().optional(),
  usd_foil: z.string().nullable().optional(),
  usd_etched: z.string().nullable().optional(),
  eur: z.string().nullable().optional(),
  eur_foil: z.string().nullable().optional(),
  tix: z.string().nullable().optional(),
});

const cardFaceSchema = z.object({
  image_uris: imageUrisSchema.optional(),
});

const scryfallCardSchema = z.object({
  id: z.string(),
  oracle_id: z.string().optional(),
  name: z.string(),
  layout: z.string().default("normal"),
  type_line: z.string().default(""),
  mana_cost: z.string().default(""),
  oracle_text: z.string().default(""),
  color_identity: z.array(z.string()).default([]),
  cmc: z.number().default(0),
  set: z.string(),
  set_name: z.string().default(""),
  collector_number: z.string().default(""),
  rarity: z.string().default("unknown"),
  finishes: z.array(z.string()).default([]),
  lang: z.string().default("en"),
  image_uris: imageUrisSchema.optional(),
  card_faces: z.array(cardFaceSchema).default([]),
  set_icon_svg_uri: z.string().optional(),
  prices: pricesSchema.optional(),
  released_at: z.string().default(""),
});

export async function parseOracleCardsFile(path: string): Promise<ParsedOracleCards> {
  const cards: Card[] = [];
  let skipped = 0;
  for await (const row of iterateBulkRows(path)) {
    const card = cardFromUnknown(row);
    if (card === null) {
      skipped += 1;
      continue;
    }
    cards.push(card);
  }
  if (cards.length === 0) {
    throw new EmptyBulkError(`Bulk file contained no usable cards: ${path}`);
  }
  return { cards, skipped };
}

export async function parseDefaultCardsFile(path: string): Promise<ParsedDefaultCards> {
  const printings: Printing[] = [];
  let skipped = 0;
  for await (const row of iterateBulkRows(path)) {
    const printing = printingFromUnknown(row);
    if (printing === null) {
      skipped += 1;
      continue;
    }
    printings.push(printing);
  }
  if (printings.length === 0) {
    throw new EmptyBulkError(`Bulk file contained no usable printings: ${path}`);
  }
  return { printings, skipped };
}

// Stream JSONL line-by-line so default_cards never hits Node's ~512MB string
// cap; JSON.parse of the whole file throws ERR_STRING_TOO_LONG.
const MAX_JSON_ARRAY_BYTES = 400 * 1024 * 1024;

async function* iterateBulkRows(path: string): AsyncGenerator {
  let fileStat: Stats;
  try {
    fileStat = await stat(path);
  } catch (error) {
    throw new BulkParseError(`Bulk file is missing: ${path}`, { cause: error });
  }
  if (fileStat.size === 0) {
    throw new EmptyBulkError(`Bulk file is empty: ${path}`);
  }

  const firstChar = await peekFirstNonWhitespace(path);
  if (firstChar === "[") {
    if (fileStat.size > MAX_JSON_ARRAY_BYTES) {
      throw new BulkParseError(`Bulk JSON array is too large to parse in memory: ${path}`);
    }
    yield* iterateJsonArrayFile(path);
    return;
  }

  yield* iterateJsonlFile(path);
}

async function peekFirstNonWhitespace(path: string): Promise<string | undefined> {
  const handle = await open(path, "r");
  try {
    const buffer = Buffer.alloc(64);
    const result = await handle.read(buffer, 0, buffer.length, 0);
    const text = buffer.subarray(0, result.bytesRead).toString("utf8").trimStart();
    return text[0];
  } finally {
    await handle.close();
  }
}

async function* iterateJsonArrayFile(path: string): AsyncGenerator {
  const text = await readFile(path, "utf8");
  let parsed: unknown;
  try {
    parsed = JSON.parse(text) as unknown;
  } catch (error) {
    throw new BulkParseError(`Bulk file is not valid JSON: ${path}`, { cause: error });
  }
  if (!isJsonArray(parsed)) {
    throw new BulkParseError(`Bulk file is not a JSON array: ${path}`);
  }
  if (parsed.length === 0) {
    throw new EmptyBulkError(`Bulk file is empty: ${path}`);
  }
  for (const row of parsed) {
    yield row;
  }
}

async function* iterateJsonlFile(path: string): AsyncGenerator {
  const reader = createInterface({
    input: createReadStream(path),
    crlfDelay: Infinity,
  });
  let sawRow = false;
  try {
    for await (const line of reader) {
      const trimmed = line.trim();
      if (trimmed === "") {
        continue;
      }
      try {
        yield JSON.parse(trimmed) as unknown;
        sawRow = true;
      } catch (error) {
        throw new BulkParseError(`Bulk file is not valid JSON: ${path}`, { cause: error });
      }
    }
  } finally {
    reader.close();
  }
  if (!sawRow) {
    throw new EmptyBulkError(`Bulk file is empty: ${path}`);
  }
}

function isJsonArray(value: unknown): value is unknown[] {
  return Array.isArray(value);
}

function cardFromUnknown(row: unknown): Card | null {
  const parsed = scryfallCardSchema.safeParse(row);
  if (!parsed.success || parsed.data.oracle_id === undefined) {
    return null;
  }
  try {
    return Card.create({
      oracleId: OracleId.from(parsed.data.oracle_id),
      name: parsed.data.name,
      layout: parsed.data.layout,
      typeLine: parsed.data.type_line,
      manaCost: parsed.data.mana_cost,
      oracleText: parsed.data.oracle_text,
      colorIdentity: parsed.data.color_identity,
      cmc: parsed.data.cmc,
    });
  } catch {
    return null;
  }
}

function printingFromUnknown(row: unknown): Printing | null {
  const parsed = scryfallCardSchema.safeParse(row);
  if (!parsed.success || parsed.data.oracle_id === undefined || parsed.data.finishes.length === 0) {
    return null;
  }
  try {
    const options: CreatePrintingOptions = {
      scryfallId: ScryfallId.from(parsed.data.id),
      oracleId: OracleId.from(parsed.data.oracle_id),
      setCode: SetCode.from(parsed.data.set),
      setName: parsed.data.set_name,
      collectorNumber: CollectorNumber.from(parsed.data.collector_number),
      rarity: parsed.data.rarity,
      finishes: parsed.data.finishes,
      lang: parsed.data.lang,
      imageUris: imageUrisFromScryfall(parsed.data),
      prices: pricesFromScryfall(parsed.data.prices),
      releasedAt: parsed.data.released_at,
    };
    if (parsed.data.set_icon_svg_uri !== undefined) {
      options.setIconSvgUri = parsed.data.set_icon_svg_uri;
    }
    return Printing.create(options);
  } catch {
    return null;
  }
}

function imageUrisFromScryfall(card: z.infer<typeof scryfallCardSchema>): ImageUris {
  const source = card.image_uris ?? card.card_faces[0]?.image_uris;
  if (source === undefined) {
    return {};
  }
  const uris: {
    small?: string;
    normal?: string;
    large?: string;
    png?: string;
    artCrop?: string;
    borderCrop?: string;
  } = {};
  if (source.small !== undefined) {
    uris.small = source.small;
  }
  if (source.normal !== undefined) {
    uris.normal = source.normal;
  }
  if (source.large !== undefined) {
    uris.large = source.large;
  }
  if (source.png !== undefined) {
    uris.png = source.png;
  }
  if (source.art_crop !== undefined) {
    uris.artCrop = source.art_crop;
  }
  if (source.border_crop !== undefined) {
    uris.borderCrop = source.border_crop;
  }
  return uris;
}

function pricesFromScryfall(
  prices: z.infer<typeof pricesSchema> | undefined,
): PrintingPrices {
  if (prices === undefined) {
    return {};
  }
  const mapped: {
    usd?: string | null;
    usdFoil?: string | null;
    usdEtched?: string | null;
    eur?: string | null;
    eurFoil?: string | null;
    tix?: string | null;
  } = {};
  if (prices.usd !== undefined) {
    mapped.usd = prices.usd;
  }
  if (prices.usd_foil !== undefined) {
    mapped.usdFoil = prices.usd_foil;
  }
  if (prices.usd_etched !== undefined) {
    mapped.usdEtched = prices.usd_etched;
  }
  if (prices.eur !== undefined) {
    mapped.eur = prices.eur;
  }
  if (prices.eur_foil !== undefined) {
    mapped.eurFoil = prices.eur_foil;
  }
  if (prices.tix !== undefined) {
    mapped.tix = prices.tix;
  }
  return mapped;
}
