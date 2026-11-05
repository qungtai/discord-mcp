import { toJsonSchemaCompat } from "@modelcontextprotocol/sdk/server/zod-json-schema-compat.js";
import { describe, expect, it } from "vitest";
import { DEFAULT_TOOLSETS, PToolRegistry, type Toolset } from "../../src/core/tool-registry.js";

interface PropertyOffender {
  tool: string;
  property: string;
  reason: string;
}

interface DescriptionLengthOffender {
  tool: string;
  length: number;
}

interface CitedToolOffender {
  tool: string;
  citedTool: string;
}

function collectPropertyDescriptionOffenders(
  schema: unknown,
  toolName: string,
  path = "",
  offenders: PropertyOffender[] = [],
): PropertyOffender[] {
  if (!schema || typeof schema !== "object") return offenders;
  const s = schema as Record<string, unknown>;

  if (s.properties && typeof s.properties === "object") {
    for (const [propName, propSchema] of Object.entries(
      s.properties as Record<string, Record<string, unknown>>,
    )) {
      const currentPath = path ? `${path}.${propName}` : propName;
      const desc = propSchema.description;
      if (typeof desc !== "string" || desc.trim() === "") {
        offenders.push({
          tool: toolName,
          property: currentPath,
          reason: "missing or empty description",
        });
      }
      collectPropertyDescriptionOffenders(propSchema, toolName, currentPath, offenders);
    }
  }

  if (s.items) {
    if (Array.isArray(s.items)) {
      s.items.forEach((item, idx) => {
        collectPropertyDescriptionOffenders(item, toolName, `${path}[${idx}]`, offenders);
      });
    } else {
      collectPropertyDescriptionOffenders(s.items, toolName, `${path}[]`, offenders);
    }
  }

  if (Array.isArray(s.anyOf)) {
    for (const variant of s.anyOf) {
      if ((variant as Record<string, unknown>)?.type !== "null") {
        collectPropertyDescriptionOffenders(variant, toolName, path, offenders);
      }
    }
  }

  if (Array.isArray(s.oneOf)) {
    for (const variant of s.oneOf) {
      if ((variant as Record<string, unknown>)?.type !== "null") {
        collectPropertyDescriptionOffenders(variant, toolName, path, offenders);
      }
    }
  }

  if (Array.isArray(s.allOf)) {
    for (const variant of s.allOf) {
      collectPropertyDescriptionOffenders(variant, toolName, path, offenders);
    }
  }

  return offenders;
}

describe("tool definitions quality", () => {
  it("enforces tool definition quality across all registered tools", async () => {
    const registry = await PToolRegistry.load();
    const tools = registry.list();
    expect(tools.length).toBeGreaterThan(0);

    const registeredToolNames = new Set(tools.map((tool) => tool.name));

    const propertyOffenders: PropertyOffender[] = [];
    const lengthOffenders: DescriptionLengthOffender[] = [];
    const citedToolOffenders: CitedToolOffender[] = [];

    for (const tool of tools) {
      // 1. Check authored description length is 150 to 900 characters
      const len = tool.description.length;
      if (len < 150 || len > 900) {
        lengthOffenders.push({ tool: tool.name, length: len });
      }

      // 2. Check cited tool names (discord_[a-z_]+) exist
      const citedMatches = tool.description.match(/discord_[a-z_]+/g) ?? [];
      for (const cited of citedMatches) {
        if (!registeredToolNames.has(cited)) {
          citedToolOffenders.push({ tool: tool.name, citedTool: cited });
        }
      }

      // 3. Check every input JSON schema property, nested object property, and object array item property has a non-empty description
      const inputSchema = toJsonSchemaCompat(tool.input);
      collectPropertyDescriptionOffenders(inputSchema, tool.name, "", propertyOffenders);
    }

    expect(
      propertyOffenders,
      `Tools with missing/empty property descriptions:\n${JSON.stringify(propertyOffenders, null, 2)}`,
    ).toEqual([]);

    expect(
      lengthOffenders,
      `Tools with description length outside 150-900 chars:\n${JSON.stringify(lengthOffenders, null, 2)}`,
    ).toEqual([]);

    expect(
      citedToolOffenders,
      `Tools citing non-existent tools:\n${JSON.stringify(citedToolOffenders, null, 2)}`,
    ).toEqual([]);
  });

  it("default toolsets hold the counts README states", async () => {
    const registry = await PToolRegistry.load();
    const count = (toolsets: readonly Toolset[]) =>
      registry.list().filter((tool) => toolsets.includes(tool.toolset)).length;

    expect(count(DEFAULT_TOOLSETS)).toBe(40);
    expect(count(["core", "messages"])).toBe(21);
  });
});
