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
  exception_id: "200",
};

it("denies call when approval is required but unconfigured", async () => {
  const { pipeline } = await harness({
    policy: new PPolicyEngine([], ["events"], false),
  });
  expect(await pipeline.call("discord_delete_guild_scheduled_event_exception", get)).toMatchObject({
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
  const result = await pipeline.call("discord_delete_guild_scheduled_event_exception", get);
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
  const result = await pipeline.call("discord_delete_guild_scheduled_event_exception", get);
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
  const tool = registry.get("discord_delete_guild_scheduled_event_exception");
  if (!tool) throw new Error("Tool not found");

  const mockDiscord = vi.fn().mockResolvedValue(undefined);
  const result = await tool.execute(
    {
      guild_id: "10",
      guild_scheduled_event_id: "100",
      exception_id: "200",
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
    method: "DELETE",
    route: "/guilds/10/scheduled-events/100/exceptions/200",
  });
  expect(result).toEqual({
    deleted: true,
    guild_id: "10",
    guild_scheduled_event_id: "100",
    exception_id: "200",
  });
});
