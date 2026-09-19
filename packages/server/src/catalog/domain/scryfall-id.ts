import { normalizeUuid } from "./uuid.js";

export class ScryfallId {
  private constructor(private readonly value: string) {}

  static from(raw: string): ScryfallId {
    return new ScryfallId(normalizeUuid(raw, "Scryfall ID"));
  }

  toString(): string {
    return this.value;
  }

  equals(other: ScryfallId): boolean {
    return this.value === other.value;
  }
}
