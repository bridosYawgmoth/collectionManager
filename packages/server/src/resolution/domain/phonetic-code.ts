import { doubleMetaphone } from "double-metaphone";

function compactNormalized(normalized: string): string {
  return normalized.replace(/ /g, "");
}

function addCodes(codes: Set<string>, value: string): void {
  if (value === "") {
    return;
  }
  const [primary, secondary] = doubleMetaphone(value);
  if (primary !== "") {
    codes.add(primary);
  }
  if (secondary !== "") {
    codes.add(secondary);
  }
}

// phoneticCodes: Double Metaphone keys for a normalized name, including the
// space-stripped form so "ether eyes" shares a code with "aetherize".
// Without this, scoring would live in SQL and the fixture suite could not
// run without Postgres. The npm algorithm stays behind this function so the
// rest of domain never mentions the package.
export function phoneticCodes(normalized: string): readonly string[] {
  const codes = new Set<string>();
  addCodes(codes, normalized);
  const compact = compactNormalized(normalized);
  if (compact !== normalized) {
    addCodes(codes, compact);
  }
  return [...codes];
}
