import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function extractFencedBlocks(content: string, lang: string): string[] {
  const regex = new RegExp(`\`\`\`${lang}\\n([\\s\\S]*?)\\n\`\`\``, "g");
  const blocks: string[] = [];
  for (const match of content.matchAll(regex)) {
    if (match[1]) {
      blocks.push(match[1].trim());
    }
  }
  return blocks;
}

function checkJsonEnvStrings(raw: string, filename: string): void {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    if (raw.startsWith('"') && raw.includes(":")) {
      parsed = JSON.parse(`{ ${raw} }`);
    } else {
      throw new Error(`Failed to parse JSON in ${filename}: ${error}`);
    }
  }

  function walk(obj: unknown): void {
    if (!obj || typeof obj !== "object") return;
    if ("env" in obj) {
      const envObj = (obj as Record<string, unknown>).env;
      expect(typeof envObj, `env property in ${filename} must be an object`).toBe("object");
      expect(envObj, `env property in ${filename} must not be null`).not.toBeNull();
      for (const [key, value] of Object.entries(envObj as Record<string, unknown>)) {
        expect(
          typeof value,
          `env value for ${key} in ${filename} must be a string, got ${typeof value}`,
        ).toBe("string");
      }
    }
    for (const val of Object.values(obj)) {
      if (typeof val === "object" && val !== null) {
        walk(val);
      }
    }
  }

  walk(parsed);
}

function checkTomlEnvStrings(raw: string, filename: string): void {
  const lines = raw.split("\n");
  let currentSection = "";
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const sectionMatch = trimmed.match(/^\[(.*)\]$/);
    if (sectionMatch?.[1]) {
      currentSection = sectionMatch[1];
      continue;
    }
    if (currentSection.endsWith(".env") || currentSection === "env") {
      const kvMatch = trimmed.match(/^([A-Za-z0-9_-]+)\s*=\s*(.*)$/);
      if (kvMatch?.[1] && kvMatch[2]) {
        const key = kvMatch[1];
        const val = kvMatch[2].trim();
        const isQuotedString =
          (val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"));
        expect(
          isQuotedString,
          `TOML env value for ${key} in ${filename} must be a quoted string, got: ${val}`,
        ).toBe(true);
      }
    }
  }
}

describe("documentation snippets", () => {
  const files = ["README.md", "docs/clients.md"];

  for (const file of files) {
    it(`validates JSON and TOML snippets in ${file}`, () => {
      const fullPath = join(process.cwd(), file);
      const content = readFileSync(fullPath, "utf8");

      const jsonBlocks = extractFencedBlocks(content, "json");
      expect(jsonBlocks.length).toBeGreaterThan(0);
      for (const block of jsonBlocks) {
        checkJsonEnvStrings(block, file);
      }

      const tomlBlocks = extractFencedBlocks(content, "toml");
      expect(tomlBlocks.length).toBeGreaterThan(0);
      for (const block of tomlBlocks) {
        checkTomlEnvStrings(block, file);
      }
    });
  }
});
