import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
// @ts-expect-error script module tested directly
import { generateToolsetsBlock } from "../../scripts/docs/generate-tools.mjs";

describe("README tools reference", () => {
  it("matches generated tool reference between markers", async () => {
    const readmePath = join(process.cwd(), "README.md");
    const readme = readFileSync(readmePath, "utf8");
    const startMarker = "<!-- tools:start -->";
    const endMarker = "<!-- tools:end -->";

    const startIndex = readme.indexOf(startMarker);
    const endIndex = readme.indexOf(endMarker);

    expect(startIndex).toBeGreaterThanOrEqual(0);
    expect(endIndex).toBeGreaterThan(startIndex);

    const actual = readme.slice(startIndex + startMarker.length, endIndex).trim();
    const expected = (await generateToolsetsBlock()).trim();

    expect(actual).toBe(expected);
  });
});
