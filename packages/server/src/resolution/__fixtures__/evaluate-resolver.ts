import { readFileSync } from "node:fs";
import { join } from "node:path";
import { OracleId } from "../../catalog/domain/oracle-id.js";
import { catalogNameFrom } from "../domain/catalog-name.js";
import { CardResolver } from "../domain/card-resolver.js";
import { InMemoryCardNameIndex } from "../domain/in-memory-card-name-index.js";
import type { ResolutionStage } from "../domain/resolution-result.js";

export interface TranscriptFixture {
  readonly spoken: string;
  readonly expect: string;
  readonly note: string;
}

export interface AccuracyBaseline {
  readonly accuracy: number;
  readonly hits: number;
  readonly total: number;
  readonly stages: Record<ResolutionStage, number>;
}

export interface EvalMiss {
  readonly spoken: string;
  readonly expect: string;
  readonly got: string;
  readonly note: string;
}

export interface EvalReport {
  readonly accuracy: number;
  readonly hits: number;
  readonly total: number;
  readonly stages: Record<ResolutionStage, number>;
  readonly misses: readonly EvalMiss[];
}

function readJson(name: string): unknown {
  const parsed: unknown = JSON.parse(readFileSync(join(import.meta.dirname, name), "utf8"));
  return parsed;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function parseTranscripts(raw: unknown): readonly TranscriptFixture[] {
  if (!Array.isArray(raw)) {
    throw new Error("transcripts.json must be an array");
  }
  return raw.map((item, index) => {
    if (!isRecord(item)) {
      throw new Error(`transcripts.json[${String(index)}] must be an object`);
    }
    if (
      typeof item.spoken !== "string" ||
      typeof item.expect !== "string" ||
      typeof item.note !== "string"
    ) {
      throw new Error(`transcripts.json[${String(index)}] needs spoken, expect, and note`);
    }
    return { spoken: item.spoken, expect: item.expect, note: item.note };
  });
}

function parseCatalog(raw: unknown): readonly string[] {
  if (!Array.isArray(raw)) {
    throw new Error("catalog.json must be an array of names");
  }
  return raw.map((item, index) => {
    if (typeof item !== "string" || item.trim() === "") {
      throw new Error(`catalog.json[${String(index)}] must be a non-empty name`);
    }
    return item;
  });
}

function parseBaseline(raw: unknown): AccuracyBaseline {
  if (!isRecord(raw)) {
    throw new Error("baseline.json must be an object");
  }
  if (
    typeof raw.accuracy !== "number" ||
    typeof raw.hits !== "number" ||
    typeof raw.total !== "number" ||
    !isRecord(raw.stages)
  ) {
    throw new Error("baseline.json needs accuracy, hits, total, and stages");
  }
  const stages = parseStages(raw.stages);
  return {
    accuracy: raw.accuracy,
    hits: raw.hits,
    total: raw.total,
    stages,
  };
}

function parseStages(raw: Record<string, unknown>): Record<ResolutionStage, number> {
  const keys: ResolutionStage[] = ["exact", "alias", "phonetic", "trigram"];
  const stages: Record<ResolutionStage, number> = {
    exact: 0,
    alias: 0,
    phonetic: 0,
    trigram: 0,
  };
  for (const key of keys) {
    const value = raw[key];
    if (typeof value !== "number") {
      throw new Error(`baseline.json stages.${key} must be a number`);
    }
    stages[key] = value;
  }
  return stages;
}

function oracleIdForIndex(index: number): OracleId {
  return OracleId.from(`aaaaaaaa-aaaa-4aaa-8aaa-${(index + 1).toString(16).padStart(12, "0")}`);
}

export function loadTranscripts(): readonly TranscriptFixture[] {
  return parseTranscripts(readJson("transcripts.json"));
}

export function loadCatalogNames(): readonly string[] {
  return parseCatalog(readJson("catalog.json"));
}

export function loadBaseline(): AccuracyBaseline {
  return parseBaseline(readJson("baseline.json"));
}

export function fixtureResolver(): CardResolver {
  const cards = loadCatalogNames().map((name, index) =>
    catalogNameFrom({ oracleId: oracleIdForIndex(index), name }),
  );
  return new CardResolver(new InMemoryCardNameIndex(cards));
}

export function evaluateResolver(resolver = fixtureResolver()): EvalReport {
  const fixtures = loadTranscripts();
  const stages: Record<ResolutionStage, number> = {
    exact: 0,
    alias: 0,
    phonetic: 0,
    trigram: 0,
  };
  const misses: EvalMiss[] = [];
  let hits = 0;

  for (const fixture of fixtures) {
    const result = resolver.match(fixture.spoken);
    if (result.status === "matched" && result.winner.card.name === fixture.expect) {
      hits += 1;
      stages[result.winner.stage] += 1;
      continue;
    }
    const got =
      result.status === "matched"
        ? result.winner.card.name
        : result.status === "ambiguous"
          ? `ambiguous:${result.candidates.map((candidate) => candidate.card.name).join("|")}`
          : "unresolved";
    misses.push({ spoken: fixture.spoken, expect: fixture.expect, got, note: fixture.note });
  }

  return {
    accuracy: hits / fixtures.length,
    hits,
    total: fixtures.length,
    stages,
    misses,
  };
}
