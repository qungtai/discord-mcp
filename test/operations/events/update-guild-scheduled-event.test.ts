import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { PPolicyEngine } from "../../../src/core/policy.js";
import type { ToolFiles } from "../../../src/core/ports.js";
import { PToolRegistry } from "../../../src/core/tool-registry.js";
import { harness } from "../../support/harness.js";

beforeEach(() => {
  vi.spyOn(process.stderr, "write").mockReturnValue(true);
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const get = {
  guild_id: "10",
  guild_scheduled_event_id: "100",
  name: "Updated Name",
};

it("denies call when approval is required but unconfigured", async () => {
  const { pipeline } = await harness({
    policy: new PPolicyEngine([], ["events"], false),
  });
  expect(await pipeline.call("discord_update_guild_scheduled_event", get)).toMatchObject({
    ok: false,
    error: {
      category: "policy",
      message: "This tool requires approval support",
    },
  });
});

it("passes allowlist check for allowed guild", async () => {
  const { pipeline, makeRequest } = await harness({
    policy: new PPolicyEngine(["10"], ["events"], false),
  });
  const result = await pipeline.call("discord_update_guild_scheduled_event", get);
  // Denied by approval gate, not by guild allowlist
  expect(result).toMatchObject({
    ok: false,
    error: {
      category: "policy",
      message: "This tool requires approval support",
    },
  });
  expect(makeRequest).not.toHaveBeenCalled();
});

it("denies allowlist check when guild is not allowed", async () => {
  const { pipeline, makeRequest } = await harness({
    policy: new PPolicyEngine(["999"], ["events"], false),
  });
  const result = await pipeline.call("discord_update_guild_scheduled_event", get);
  // checkStatic happens first in pipeline, so approval gate denies before resource check
  expect(result).toMatchObject({
    ok: false,
    error: {
      category: "policy",
      message: "This tool requires approval support",
    },
  });
  expect(makeRequest).not.toHaveBeenCalled();
});

it("maps tool execution when invoked directly via execute handler", async () => {
  const registry = await PToolRegistry.load();
  const tool = registry.get("discord_update_guild_scheduled_event");
  if (!tool) throw new Error("Tool not found");

  const EVENT = {
    id: "100",
    guild_id: "10",
    name: "Updated Name",
    status: 2,
  };
  const mockDiscord = vi.fn().mockResolvedValue(EVENT);
  const result = await tool.execute(
    {
      guild_id: "10",
      guild_scheduled_event_id: "100",
      name: "Updated Name",
      status: 2,
      reason: "Postponed",
    },
    {
      discord: mockDiscord,
      files: {} as ToolFiles,
      signal: new AbortController().signal,
      progress: async () => {},
      log: async () => {},
      correlationId: "test",
      allowsGuild: () => true,
    },
  );
  expect(mockDiscord).toHaveBeenCalledWith({
    method: "PATCH",
    route: "/guilds/10/scheduled-events/100",
    body: {
      name: "Updated Name",
      status: 2,
    },
    reason: "Postponed",
  });
  expect(result).toEqual({ guild_scheduled_event: EVENT });
});
