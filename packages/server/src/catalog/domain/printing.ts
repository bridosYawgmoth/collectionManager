import type { CollectorNumber } from "./collector-number.js";
import type { OracleId } from "./oracle-id.js";
import type { ScryfallId } from "./scryfall-id.js";
import type { SetCode } from "./set-code.js";

export interface ImageUris {
  readonly small?: string;
  readonly normal?: string;
  readonly large?: string;
  readonly png?: string;
  readonly artCrop?: string;
  readonly borderCrop?: string;
}

export interface PrintingPrices {
  readonly usd?: string | null;
  readonly usdFoil?: string | null;
  readonly usdEtched?: string | null;
  readonly eur?: string | null;
  readonly eurFoil?: string | null;
  readonly tix?: string | null;
}

export interface CreatePrintingOptions {
  scryfallId: ScryfallId;
  oracleId: OracleId;
  setCode: SetCode;
  setName: string;
  collectorNumber: CollectorNumber;
  rarity: string;
  finishes: readonly string[];
  lang: string;
  imageUris: ImageUris;
  setIconSvgUri?: string;
  prices: PrintingPrices;
  releasedAt: string;
}

export class Printing {
  private constructor(
    readonly scryfallId: ScryfallId,
    readonly oracleId: OracleId,
    readonly setCode: SetCode,
    readonly setName: string,
    readonly collectorNumber: CollectorNumber,
    readonly rarity: string,
    readonly finishes: readonly string[],
    readonly lang: string,
    readonly imageUris: ImageUris,
    readonly setIconSvgUri: string | undefined,
    readonly prices: PrintingPrices,
    readonly releasedAt: string,
  ) {}

  static create(options: CreatePrintingOptions): Printing {
    if (options.finishes.length === 0) {
      throw new Error("Printing must have at least one finish");
    }
    return new Printing(
      options.scryfallId,
      options.oracleId,
      options.setCode,
      options.setName,
      options.collectorNumber,
      options.rarity,
      Object.freeze([...options.finishes]),
      options.lang,
      Object.freeze({ ...options.imageUris }),
      options.setIconSvgUri,
      Object.freeze({ ...options.prices }),
      options.releasedAt,
    );
  }
}
