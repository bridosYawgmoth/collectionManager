import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { dotenvPath } from "./config.js";

describe("dotenvPath", () => {
  it("resolves .env next to the committed example at the repo root", () => {
    const example = resolve(dotenvPath(), "..", ".env.example");
    const workspace = resolve(dotenvPath(), "..", "pnpm-workspace.yaml");

    expect(existsSync(example)).toBe(true);
    expect(existsSync(workspace)).toBe(true);
  });
});
