import { normalizeCardName } from "./normalize-card-name.js";
import type { OracleId } from "./oracle-id.js";

export interface CreateCardOptions {
  oracleId: OracleId;
  name: string;
  layout: string;
  typeLine: string;
  manaCost: string;
  oracleText: string;
  colorIdentity: readonly string[];
  cmc: number;
}

export class Card {
  private constructor(
    readonly oracleId: OracleId,
    readonly name: string,
    readonly nameNormalized: string,
    readonly layout: string,
    readonly typeLine: string,
    readonly manaCost: string,
    readonly oracleText: string,
    readonly colorIdentity: readonly string[],
    readonly cmc: number,
  ) {}

  static create(options: CreateCardOptions): Card {
    const name = options.name.trim();
    if (name === "") {
      throw new Error("Card name is required");
    }
    return new Card(
      options.oracleId,
      name,
      normalizeCardName(name),
      options.layout,
      options.typeLine,
      options.manaCost,
      options.oracleText,
      Object.freeze([...options.colorIdentity]),
      options.cmc,
    );
  }
}
