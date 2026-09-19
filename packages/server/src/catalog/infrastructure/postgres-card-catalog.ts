import type { CardCatalogPort, CatalogCounts } from "../domain/card-catalog-port.js";
import { Card } from "../domain/card.js";
import { CollectorNumber } from "../domain/collector-number.js";
import type { CreatePrintingOptions, ImageUris, PrintingPrices } from "../domain/printing.js";
import { Printing } from "../domain/printing.js";
import { OracleId } from "../domain/oracle-id.js";
import { ScryfallId } from "../domain/scryfall-id.js";
import { SetCode } from "../domain/set-code.js";
import type { SqlClient } from "../../platform/db.js";

const UPSERT_BATCH_SIZE = 500;

interface CardRow {
  oracle_id: string;
  name: string;
  layout: string;
  type_line: string;
  mana_cost: string;
  oracle_text: string;
  color_identity: string[];
  cmc: string | number;
}

interface PrintingRow {
  scryfall_id: string;
  oracle_id: string;
  set_code: string;
  set_name: string;
  collector_number: string;
  rarity: string;
  finishes: string[];
  lang: string;
  image_uris: unknown;
  set_icon_svg_uri: string | null;
  prices: unknown;
  released_at: string | null;
}

export class PostgresCardCatalog implements CardCatalogPort {
  constructor(private readonly sql: SqlClient) {}

  async upsertCards(cards: readonly Card[]): Promise<void> {
    for (const batch of chunk(cards, UPSERT_BATCH_SIZE)) {
      const rows = batch.map((card) => ({
        oracle_id: card.oracleId.toString(),
        name: card.name,
        name_normalized: card.nameNormalized,
        layout: card.layout,
        type_line: card.typeLine,
        mana_cost: card.manaCost,
        oracle_text: card.oracleText,
        color_identity: [...card.colorIdentity],
        cmc: card.cmc,
      }));
      await this.sql`
        INSERT INTO cards ${this.sql(rows)}
        ON CONFLICT (oracle_id) DO UPDATE SET
          name = EXCLUDED.name,
          name_normalized = EXCLUDED.name_normalized,
          layout = EXCLUDED.layout,
          type_line = EXCLUDED.type_line,
          mana_cost = EXCLUDED.mana_cost,
          oracle_text = EXCLUDED.oracle_text,
          color_identity = EXCLUDED.color_identity,
          cmc = EXCLUDED.cmc,
          updated_at = now()
      `;
    }
  }

  async upsertPrintings(printings: readonly Printing[]): Promise<void> {
    for (const batch of chunk(printings, UPSERT_BATCH_SIZE)) {
      const rows = batch.map((printing) => ({
        scryfall_id: printing.scryfallId.toString(),
        oracle_id: printing.oracleId.toString(),
        set_code: printing.setCode.toString(),
        set_name: printing.setName,
        collector_number: printing.collectorNumber.toString(),
        rarity: printing.rarity,
        finishes: [...printing.finishes],
        lang: printing.lang,
        image_uris: this.sql.json(toJsonRecord(printing.imageUris)),
        set_icon_svg_uri: printing.setIconSvgUri ?? null,
        prices: this.sql.json(toJsonRecord(printing.prices)),
        released_at: printing.releasedAt,
      }));
      await this.sql`
        INSERT INTO printings ${this.sql(rows)}
        ON CONFLICT (scryfall_id) DO UPDATE SET
          oracle_id = EXCLUDED.oracle_id,
          set_code = EXCLUDED.set_code,
          set_name = EXCLUDED.set_name,
          collector_number = EXCLUDED.collector_number,
          rarity = EXCLUDED.rarity,
          finishes = EXCLUDED.finishes,
          lang = EXCLUDED.lang,
          image_uris = EXCLUDED.image_uris,
          set_icon_svg_uri = EXCLUDED.set_icon_svg_uri,
          prices = EXCLUDED.prices,
          released_at = EXCLUDED.released_at,
          updated_at = now()
      `;
    }
  }

  async getCard(oracleId: OracleId): Promise<Card | null> {
    const rows = await this.sql<CardRow[]>`
      SELECT oracle_id, name, layout, type_line, mana_cost, oracle_text, color_identity, cmc
      FROM cards
      WHERE oracle_id = ${oracleId.toString()}
    `;
    const row = rows[0];
    if (row === undefined) {
      return null;
    }
    return cardFromRow(row);
  }

  async getPrinting(scryfallId: ScryfallId): Promise<Printing | null> {
    const rows = await this.sql<PrintingRow[]>`
      SELECT
        scryfall_id,
        oracle_id,
        set_code,
        set_name,
        collector_number,
        rarity,
        finishes,
        lang,
        image_uris,
        set_icon_svg_uri,
        prices,
        released_at::text AS released_at
      FROM printings
      WHERE scryfall_id = ${scryfallId.toString()}
    `;
    const row = rows[0];
    if (row === undefined) {
      return null;
    }
    return printingFromRow(row);
  }

  async counts(): Promise<CatalogCounts> {
    const cardRows = await this.sql<{ count: string }[]>`SELECT count(*)::text AS count FROM cards`;
    const printingRows = await this.sql<{ count: string }[]>`
      SELECT count(*)::text AS count FROM printings
    `;
    return {
      cards: Number.parseInt(cardRows[0]?.count ?? "0", 10),
      printings: Number.parseInt(printingRows[0]?.count ?? "0", 10),
    };
  }

  async setCodes(): Promise<readonly SetCode[]> {
    const rows = await this.sql<{ set_code: string }[]>`
      SELECT DISTINCT set_code FROM printings ORDER BY set_code
    `;
    return rows.map((row) => SetCode.from(row.set_code));
  }

  // rebuildTrigramIndex: Postgres maintains the GIN index on write; REINDEX
  // after a bulk upsert packs it. Phonetic indexes belong to resolution.
  async rebuildTrigramIndex(): Promise<void> {
    await this.sql.unsafe("REINDEX INDEX cards_name_normalized_trgm");
  }
}

function cardFromRow(row: CardRow): Card {
  return Card.create({
    oracleId: OracleId.from(row.oracle_id),
    name: row.name,
    layout: row.layout,
    typeLine: row.type_line,
    manaCost: row.mana_cost,
    oracleText: row.oracle_text,
    colorIdentity: row.color_identity,
    cmc: typeof row.cmc === "number" ? row.cmc : Number(row.cmc),
  });
}

function printingFromRow(row: PrintingRow): Printing {
  const options: CreatePrintingOptions = {
    scryfallId: ScryfallId.from(row.scryfall_id),
    oracleId: OracleId.from(row.oracle_id),
    setCode: SetCode.from(row.set_code),
    setName: row.set_name,
    collectorNumber: CollectorNumber.from(row.collector_number),
    rarity: row.rarity,
    finishes: row.finishes,
    lang: row.lang,
    imageUris: imageUrisFromDb(row.image_uris),
    prices: pricesFromDb(row.prices),
    releasedAt: row.released_at ?? "",
  };
  if (row.set_icon_svg_uri !== null) {
    options.setIconSvgUri = row.set_icon_svg_uri;
  }
  return Printing.create(options);
}

function imageUrisFromDb(value: unknown): ImageUris {
  const record = asRecord(value);
  const uris: MutableImageUris = {};
  const small = stringField(record, "small");
  if (small !== undefined) {
    uris.small = small;
  }
  const normal = stringField(record, "normal");
  if (normal !== undefined) {
    uris.normal = normal;
  }
  const large = stringField(record, "large");
  if (large !== undefined) {
    uris.large = large;
  }
  const png = stringField(record, "png");
  if (png !== undefined) {
    uris.png = png;
  }
  const artCrop = stringField(record, "artCrop");
  if (artCrop !== undefined) {
    uris.artCrop = artCrop;
  }
  const borderCrop = stringField(record, "borderCrop");
  if (borderCrop !== undefined) {
    uris.borderCrop = borderCrop;
  }
  return uris;
}

function pricesFromDb(value: unknown): PrintingPrices {
  const record = asRecord(value);
  const prices: MutablePrices = {};
  const usd = priceField(record, "usd");
  if (usd !== undefined) {
    prices.usd = usd;
  }
  const usdFoil = priceField(record, "usdFoil");
  if (usdFoil !== undefined) {
    prices.usdFoil = usdFoil;
  }
  const usdEtched = priceField(record, "usdEtched");
  if (usdEtched !== undefined) {
    prices.usdEtched = usdEtched;
  }
  const eur = priceField(record, "eur");
  if (eur !== undefined) {
    prices.eur = eur;
  }
  const eurFoil = priceField(record, "eurFoil");
  if (eurFoil !== undefined) {
    prices.eurFoil = eurFoil;
  }
  const tix = priceField(record, "tix");
  if (tix !== undefined) {
    prices.tix = tix;
  }
  return prices;
}

interface MutableImageUris {
  small?: string;
  normal?: string;
  large?: string;
  png?: string;
  artCrop?: string;
  borderCrop?: string;
}

interface MutablePrices {
  usd?: string | null;
  usdFoil?: string | null;
  usdEtched?: string | null;
  eur?: string | null;
  eurFoil?: string | null;
  tix?: string | null;
}

function toJsonRecord(value: ImageUris | PrintingPrices): Record<string, string | null> {
  const record: Record<string, string | null> = {};
  for (const [key, raw] of Object.entries(value)) {
    const entry: unknown = raw;
    if (typeof entry === "string" || entry === null) {
      record[key] = entry;
    }
  }
  return record;
}

function asRecord(value: unknown): Record<string, unknown> {
  if (value !== null && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

function stringField(record: Record<string, unknown>, key: string): string | undefined {
  const value = record[key];
  return typeof value === "string" ? value : undefined;
}

function priceField(record: Record<string, unknown>, key: string): string | null | undefined {
  const value = record[key];
  if (value === undefined) {
    return undefined;
  }
  if (value === null) {
    return null;
  }
  return typeof value === "string" ? value : undefined;
}

function chunk<T>(items: readonly T[], size: number): T[][] {
  if (items.length === 0) {
    return [];
  }
  const batches: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    batches.push(items.slice(index, index + size));
  }
  return batches;
}
