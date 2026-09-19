import { describe, expect, it } from "vitest";
import { OracleId } from "./oracle-id.js";

describe("OracleId", () => {
  it("accepts a canonical UUID and compares by value", () => {
    const left = OracleId.from("446C7D5C-8A1A-4B0E-9C3A-0A1B2C3D4E5F");
    const right = OracleId.from("446c7d5c-8a1a-4b0e-9c3a-0a1b2c3d4e5f");

    expect(left.toString()).toBe("446c7d5c-8a1a-4b0e-9c3a-0a1b2c3d4e5f");
    expect(left.equals(right)).toBe(true);
  });

  it("rejects a non-UUID so a set code cannot pass as oracle identity", () => {
    expect(() => OracleId.from("lea")).toThrow(/invalid oracle id/i);
  });
});
