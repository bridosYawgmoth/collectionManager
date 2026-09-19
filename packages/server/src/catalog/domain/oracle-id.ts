import { normalizeUuid } from "./uuid.js";

export class OracleId {
  private constructor(private readonly value: string) {}

  static from(raw: string): OracleId {
    return new OracleId(normalizeUuid(raw, "Oracle ID"));
  }

  toString(): string {
    return this.value;
  }

  equals(other: OracleId): boolean {
    return this.value === other.value;
  }
}
