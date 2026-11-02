import { describe, expect, it } from "vitest";
import { PToolRegistry, scopeIds } from "../../src/core/tool-registry.js";

const SCOPED_KEY = /(^|_)(guild|channel|thread|webhook)_ids?$/;
// Keys Discord checks against the guild or channel in the route; each entry is "tool.key".
const EXCEPTIONS = new Set<string>([]);

describe("scope declarations", () => {
  it("scope every guild, channel, thread and webhook ID input", async () => {
    const missing = (await PToolRegistry.load()).list().flatMap((tool) => {
      const scoped = new Set(tool.scope === "none" ? [] : Object.values(tool.scope).flat());
      return Object.keys(tool.input.shape)
        .filter((key) => SCOPED_KEY.test(key) && !scoped.has(key))
        .map((key) => `${tool.name}.${key}`)
        .filter((entry) => !EXCEPTIONS.has(entry));
    });
    expect(missing).toEqual([]);
  });
  it("skips a null scope value because null clears the field (F4)", async () => {
    const tool = (await PToolRegistry.load()).list()[0];
    if (!tool) throw new Error("No tools");
    const scoped = { ...tool, scope: { channel: "channel_id" as const } };
    expect(scopeIds(scoped, { channel_id: null }).byKind).toEqual({});
    expect(scopeIds(scoped, { channel_id: "1" }).byKind).toEqual({ channel: ["1"] });
  });
  it("audits unscoped target IDs (F2)", async () => {
    const tool = (await PToolRegistry.load()).list()[0];
    if (!tool) throw new Error("No tools");
    const input = { guild_id: "1", user_id: "2", role_ids: ["3", "4"], code: "x", name: "n" };
    expect(scopeIds({ ...tool, scope: "none" }, input).resources).toEqual({
      guild_id: "1",
      user_id: "2",
      role_ids: "3,4",
      code: "x",
    });
  });
});
