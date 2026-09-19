import { describe, expect, it } from "vitest";
import { evaluateResolver, loadBaseline } from "./evaluate-resolver.js";

describe("resolver accuracy baseline", () => {
  it("does not drop below the committed accuracy, and records improvements", () => {
    const report = evaluateResolver();
    const baseline = loadBaseline();

    const stageSummary = Object.entries(report.stages)
      .map(([stage, count]) => `${stage}=${String(count)}`)
      .join(" ");
    const missSummary = report.misses
      .map((miss) => `  ${miss.spoken} → ${miss.got} (want ${miss.expect})`)
      .join("\n");

    // Report is part of the committed number: print it so a CI log shows
    // where accuracy moved, not only that a threshold failed.
    console.log(
      `resolver-eval ${String(report.hits)}/${String(report.total)} ${(report.accuracy * 100).toFixed(1)}% [${stageSummary}]`,
    );
    if (missSummary !== "") {
      console.log(`misses:\n${missSummary}`);
    }

    expect(report.total).toBe(baseline.total);
    expect(
      report.accuracy,
      report.accuracy < baseline.accuracy
        ? `accuracy dropped to ${(report.accuracy * 100).toFixed(1)}% from baseline ${(baseline.accuracy * 100).toFixed(1)}%`
        : `accuracy improved to ${(report.accuracy * 100).toFixed(1)}% from ${(baseline.accuracy * 100).toFixed(1)}%; update baseline.json`,
    ).toBe(baseline.accuracy);
  });
});
