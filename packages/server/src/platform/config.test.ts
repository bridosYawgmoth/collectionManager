import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { dotenvPath, DEFAULT_SCRYFALL_USER_AGENT } from "./config.js";

describe("dotenvPath", () => {
  it("resolves .env next to the committed example at the repo root", () => {
    const example = resolve(dotenvPath(), "..", ".env.example");
    const workspace = resolve(dotenvPath(), "..", "pnpm-workspace.yaml");

    expect(existsSync(example)).toBe(true);
    expect(existsSync(workspace)).toBe(true);
  });

  it("defaults a descriptive Scryfall User-Agent so bulk requests identify this app", () => {
    expect(DEFAULT_SCRYFALL_USER_AGENT).toMatch(/collectionManager/i);
    expect(DEFAULT_SCRYFALL_USER_AGENT).toMatch(/github\.com\/bridosYawgmoth\/collectionManager/);
  });
});
