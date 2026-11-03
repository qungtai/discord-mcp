import { describe, expect, it } from "vitest";
import { PToolRegistry } from "../../src/core/tool-registry.js";

// AGENTS.md section 3: every tool name is discord_<verb>_<noun>.
const NAME =
  /^discord_(get|list|create|update|delete|add|send|edit|search|bulk|ban|unban|prune|preview|sync|follow|crosspost|trigger|join|leave|download|set|count|end|review|execute)_[a-z0-9_]+$/;

describe("tool names", () => {
  it("follow discord_<verb>_<noun>", async () => {
    const invalid = (await PToolRegistry.load())
      .list()
      .map((tool) => tool.name)
      .filter((name) => !NAME.test(name));
    expect(invalid).toEqual([]);
  });
});
