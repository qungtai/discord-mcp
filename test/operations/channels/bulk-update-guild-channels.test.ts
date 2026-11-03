import type { ResponseLike } from "@discordjs/rest";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { PPolicyEngine } from "../../../src/core/policy.js";
import { PToolRegistry } from "../../../src/core/tool-registry.js";
import { bulkUpdateGuildChannels } from "../../../src/operations/channels/bulk-update-guild-channels.js";
import { errorOf, harness, json } from "../../support/harness.js";

beforeEach(() => {
  vi.spyOn(process.stderr, "write").mockReturnValue(true);
});
afterEach(() => {
  vi.restoreAllMocks();
});

const toolRegistry = () => {
  const registry = new PToolRegistry();
  registry.register(bulkUpdateGuildChannels);
  return registry;
};

it("modifies channel positions with reason header after the client accepts approval and returns 204", async () => {
  const { client, request } = await harness({
    registry: toolRegistry(),
    policy: new PPolicyEngine([], ["channels"], false),
    makeRequest: async () => new Response(null, { status: 204 }) as unknown as ResponseLike,
  });
  const result = await client.callTool({
    name: "discord_bulk_update_guild_channels",
    arguments: {
      guild_id: "200",
      channels: [
        { id: "100", position: 1, parent_id: "10", lock_permissions: true },
        { id: "101", position: 2 },
      ],
      reason: "Reordering channel structure",
    },
  });

  const req = request();
  expect(req.method).toBe("PATCH");
  expect(req.url).toBe("https://discord.com/api/v10/guilds/200/channels");
  expect(new Headers(req.headers as HeadersInit).get("x-audit-log-reason")).toBe(
    encodeURIComponent("Reordering channel structure"),
  );
  expect(JSON.parse(String(req.body))).toEqual([
    { id: "100", position: 1, parent_id: "10", lock_permissions: true },
    { id: "101", position: 2 },
  ]);
  expect(result.structuredContent).toEqual({
    updated: true,
    guild_id: "200",
    channel_ids: ["100", "101"],
  });
});

it("passes allowlist check when guild is allowed", async () => {
  const { client, request } = await harness({
    registry: toolRegistry(),
    policy: new PPolicyEngine(["200"], ["channels"], false),
    makeRequest: async () => new Response(null, { status: 204 }) as unknown as ResponseLike,
  });
  const result = await client.callTool({
    name: "discord_bulk_update_guild_channels",
    arguments: {
      guild_id: "200",
      channels: [{ id: "100", position: 0 }],
    },
  });
  expect(result.structuredContent).toEqual({
    updated: true,
    guild_id: "200",
    channel_ids: ["100"],
  });
  expect(request().method).toBe("PATCH");
});

it("denies access when guild is not allowed", async () => {
  const { client, makeRequest } = await harness({
    registry: toolRegistry(),
    policy: new PPolicyEngine(["999"], ["channels"], false),
  });
  const result = await client.callTool({
    name: "discord_bulk_update_guild_channels",
    arguments: {
      guild_id: "200",
      channels: [{ id: "100", position: 0 }],
    },
  });
  expect(errorOf(result)).toMatchObject({
    category: "policy",
    message: "Guild is not allowed",
  });
  expect(makeRequest).not.toHaveBeenCalled();
});

it("blocks execution in read-only mode", async () => {
  const { pipeline, makeRequest } = await harness({
    registry: toolRegistry(),
    policy: new PPolicyEngine([], ["channels"], true),
  });
  const result = await pipeline.call("discord_bulk_update_guild_channels", {
    guild_id: "200",
    channels: [{ id: "100", position: 0 }],
  });
  expect(result).toMatchObject({
    error: { category: "policy", message: "Read-only mode" },
  });
  expect(makeRequest).not.toHaveBeenCalled();
});

it.each([
  { input: { guild_id: "200", channels: [] }, desc: "empty channels array" },
  {
    input: { guild_id: "200", channels: [{ id: "100", position: -1 }] },
    desc: "negative position",
  },
  {
    input: { guild_id: "200", channels: [{ id: "100", lock_permission: true }] },
    desc: "misspelled nested key",
  },
  { input: { guild_id: "not-a-snowflake", channels: [{ id: "100" }] }, desc: "invalid guild_id" },
  { input: { guild_id: "200", channels: [{ id: "not-a-snowflake" }] }, desc: "invalid channel id" },
])("validates input: $desc", async ({ input }) => {
  const { client, makeRequest } = await harness({
    registry: toolRegistry(),
    policy: new PPolicyEngine([], ["channels"], false),
  });
  const result = await client.callTool({
    name: "discord_bulk_update_guild_channels",
    arguments: input,
  });
  expect(errorOf(result)).toMatchObject({ category: "validation" });
  expect(makeRequest).not.toHaveBeenCalled();
});

it.each([
  [403, 50013, "permission", "Check the bot permissions; this tool needs ManageChannels"],
  [404, 10004, "not_found", "Check the IDs in the request"],
])("handles HTTP %i error", async (status, code, category, remediation) => {
  const { client } = await harness({
    registry: toolRegistry(),
    policy: new PPolicyEngine([], ["channels"], false),
    makeRequest: async () => json({ message: "Discord error", code }, { status }),
  });
  const result = await client.callTool({
    name: "discord_bulk_update_guild_channels",
    arguments: {
      guild_id: "200",
      channels: [{ id: "100", position: 0 }],
    },
  });
  expect(errorOf(result)).toMatchObject({
    category,
    status,
    discord_code: code,
    remediation,
  });
});
