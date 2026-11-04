import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { PPolicyEngine } from "../../../src/core/policy.js";
import { PToolRegistry } from "../../../src/core/tool-registry.js";
import { pruneGuild } from "../../../src/operations/members/prune-guild.js";
import { errorOf, harness, json } from "../../support/harness.js";

beforeEach(() => {
  vi.spyOn(process.stderr, "write").mockReturnValue(true);
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it("prunes members with body parameters and reason after the client accepts approval", async () => {
  const registry = new PToolRegistry();
  registry.register(pruneGuild);
  const { client, request } = await harness({
    registry,
    policy: new PPolicyEngine([], ["members"], false),
    respond: () => ({ pruned: 15 }),
  });
  const result = await client.callTool({
    name: "discord_prune_guild",
    arguments: {
      guild_id: "123",
      days: 7,
      compute_prune_count: true,
      include_roles: ["201", "202"],
      reason: "Pruning inactive accounts",
    },
  });
  const req = request();
  expect(req.method).toBe("POST");
  expect(req.url).toBe("https://discord.com/api/v10/guilds/123/prune");
  expect(new Headers(req.headers as HeadersInit).get("x-audit-log-reason")).toBe(
    encodeURIComponent("Pruning inactive accounts"),
  );
  expect(JSON.parse(String(req.body))).toEqual({
    days: 7,
    compute_prune_count: true,
    include_roles: ["201", "202"],
  });
  expect(result.structuredContent).toEqual({
    pruned: 15,
  });
});

it("passes allowlist check when guild is allowed", async () => {
  const registry = new PToolRegistry();
  registry.register(pruneGuild);
  const { client, request } = await harness({
    registry,
    policy: new PPolicyEngine(["123"], ["members"], false),
    respond: () => ({ pruned: 5 }),
  });
  const result = await client.callTool({
    name: "discord_prune_guild",
    arguments: { guild_id: "123", days: 14 },
  });
  expect(result.structuredContent).toEqual({ pruned: 5 });
  expect(request()).toMatchObject({
    method: "POST",
    url: "https://discord.com/api/v10/guilds/123/prune",
  });
});

it("denies access when guild is not allowed", async () => {
  const registry = new PToolRegistry();
  registry.register(pruneGuild);
  const { client, makeRequest } = await harness({
    registry,
    policy: new PPolicyEngine(["999"], ["members"], false),
  });
  const result = await client.callTool({
    name: "discord_prune_guild",
    arguments: { guild_id: "123" },
  });
  expect(errorOf(result)).toMatchObject({
    category: "policy",
    message: "Guild is not allowed",
  });
  expect(makeRequest).not.toHaveBeenCalled();
});

it("blocks execution in read-only mode", async () => {
  const registry = new PToolRegistry();
  registry.register(pruneGuild);
  const { pipeline, makeRequest } = await harness({
    registry,
    policy: new PPolicyEngine([], ["members"], true),
  });
  const result = await pipeline.call("discord_prune_guild", {
    guild_id: "123",
  });
  expect(result).toMatchObject({
    error: { category: "policy", message: "Read-only mode" },
  });
  expect(makeRequest).not.toHaveBeenCalled();
});

it.each([
  ["days < 1", { guild_id: "123", days: 0 }],
  ["days > 30", { guild_id: "123", days: 31 }],
  [
    "include_roles > 100",
    { guild_id: "123", include_roles: Array.from({ length: 101 }, (_, i) => String(i + 1)) },
  ],
])("validates input strictly: %s", async (_, args) => {
  const registry = new PToolRegistry();
  registry.register(pruneGuild);
  const { client, makeRequest } = await harness({
    registry,
    policy: new PPolicyEngine([], ["members"], false),
  });
  const result = await client.callTool({
    name: "discord_prune_guild",
    arguments: args,
  });
  expect(errorOf(result)).toMatchObject({ category: "validation" });
  expect(makeRequest).not.toHaveBeenCalled();
});

it("handles 403 missing permissions error", async () => {
  const registry = new PToolRegistry();
  registry.register(pruneGuild);
  const { pipeline } = await harness({
    registry,
    policy: new PPolicyEngine([], ["members"], false),
    makeRequest: async () => json({ message: "Missing Permissions", code: 50013 }, { status: 403 }),
  });
  expect(
    await pipeline.call("discord_prune_guild", { guild_id: "123" }, { approve: async () => true }),
  ).toMatchObject({
    ok: false,
    error: {
      category: "permission",
      status: 403,
      discord_code: 50013,
      remediation: "Check the bot permissions; this tool needs KickMembers, ManageGuild",
    },
  });
});

it("handles 404 error", async () => {
  const registry = new PToolRegistry();
  registry.register(pruneGuild);
  const { pipeline } = await harness({
    registry,
    policy: new PPolicyEngine([], ["members"], false),
    makeRequest: async () => json({ message: "Unknown Guild", code: 10004 }, { status: 404 }),
  });
  expect(
    await pipeline.call("discord_prune_guild", { guild_id: "123" }, { approve: async () => true }),
  ).toMatchObject({
    ok: false,
    error: {
      category: "not_found",
      status: 404,
      discord_code: 10004,
      remediation: "Check the IDs in the request",
    },
  });
});
