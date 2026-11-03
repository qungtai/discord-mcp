import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  computeSummaryNumbers,
  renderSummary,
  renderToolsBlock,
} from "../../scripts/docs/generate-tools.mjs";
import { DEFAULT_TOOLSETS, PToolRegistry, TOOLSETS } from "../../src/core/tool-registry.js";

describe("README tools reference", () => {
  it("matches generated tool reference between markers", async () => {
    const readmePath = join(process.cwd(), "README.md");
    const readme = readFileSync(readmePath, "utf8");

    const reg = await PToolRegistry.load(join(process.cwd(), "src/operations/"));

    // Check summary block
    const summaryStart = "<!-- summary:start -->";
    const summaryEnd = "<!-- summary:end -->";
    const sStartIdx = readme.indexOf(summaryStart);
    const sEndIdx = readme.indexOf(summaryEnd);
    expect(sStartIdx).toBeGreaterThanOrEqual(0);
    expect(sEndIdx).toBeGreaterThan(sStartIdx);

    const summary = computeSummaryNumbers(reg, TOOLSETS);
    const expectedSummary = renderSummary(summary);
    expect(readme.slice(sStartIdx + summaryStart.length, sEndIdx).trim()).toBe(
      expectedSummary.trim(),
    );

    // Check config toolsets block
    const configToolsetsStart = "<!-- config-toolsets:start -->";
    const configToolsetsEnd = "<!-- config-toolsets:end -->";
    const cStartIdx = readme.indexOf(configToolsetsStart);
    const cEndIdx = readme.indexOf(configToolsetsEnd);
    expect(cStartIdx).toBeGreaterThanOrEqual(0);
    expect(cEndIdx).toBeGreaterThan(cStartIdx);
    expect(readme.slice(cStartIdx + configToolsetsStart.length, cEndIdx).trim()).toBe(
      `Available: ${summary.implementedToolsets.join(", ")}.`,
    );

    // Check tools block
    const startMarker = "<!-- tools:start -->";
    const endMarker = "<!-- tools:end -->";

    const startIndex = readme.indexOf(startMarker);
    const endIndex = readme.indexOf(endMarker);

    expect(startIndex).toBeGreaterThanOrEqual(0);
    expect(endIndex).toBeGreaterThan(startIndex);

    const actual = readme.slice(startIndex + startMarker.length, endIndex).trim();
    const expected = renderToolsBlock(reg, TOOLSETS, DEFAULT_TOOLSETS).trim();

    expect(actual).toBe(expected);
  });
});
