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
  vi.unstubAllGlobals();
});

it("has approval enabled by default and is blocked by policy until approval flow is supported", async () => {
  const { pipeline } = await harness({
    policy: new PPolicyEngine([], ["channels"], false),
  });
  expect(
    await pipeline.call("discord_bulk_update_guild_channels", {
      guild_id: "200",
      channels: [{ id: "100", position: 1 }],
    }),
  ).toMatchObject({
    ok: false,
    error: {
      category: "policy",
      message: "This tool requires approval support",
      remediation: "Wait for the approval flow",
    },
  });
});

it("modifies channel positions with reason header when approval is satisfied", async () => {
  const registry = new PToolRegistry();
  registry.register({ ...bulkUpdateGuildChannels, approval: false });
  const { client, request } = await harness({
    registry,
    policy: new PPolicyEngine([], ["channels"], false),
    respond: () => undefined,
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
  expect(result.structuredContent).toEqual({ updated: true, guild_id: "200" });
});

it("passes allowlist check when guild is allowed", async () => {
  const registry = new PToolRegistry();
  registry.register({ ...bulkUpdateGuildChannels, approval: false });
  const { client, request } = await harness({
    registry,
    policy: new PPolicyEngine(["200"], ["channels"], false),
    respond: () => undefined,
  });
  const result = await client.callTool({
    name: "discord_bulk_update_guild_channels",
    arguments: {
      guild_id: "200",
      channels: [{ id: "100", position: 0 }],
    },
  });
  expect(result.structuredContent).toEqual({ updated: true, guild_id: "200" });
  expect(request().method).toBe("PATCH");
});

it("denies access when guild is not allowed", async () => {
  const registry = new PToolRegistry();
  registry.register({ ...bulkUpdateGuildChannels, approval: false });
  const { client, makeRequest } = await harness({
    registry,
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
  const registry = new PToolRegistry();
  registry.register({ ...bulkUpdateGuildChannels, approval: false });
  const { pipeline, makeRequest } = await harness({
    registry,
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

it("validates channels array is not empty", async () => {
  const registry = new PToolRegistry();
  registry.register({ ...bulkUpdateGuildChannels, approval: false });
  const { client, makeRequest } = await harness({
    registry,
    policy: new PPolicyEngine([], ["channels"], false),
  });
  const result = await client.callTool({
    name: "discord_bulk_update_guild_channels",
    arguments: {
      guild_id: "200",
      channels: [],
    },
  });
  expect(errorOf(result)).toMatchObject({ category: "validation" });
  expect(makeRequest).not.toHaveBeenCalled();
});

it("handles 403 missing permissions error", async () => {
  const registry = new PToolRegistry();
  registry.register({ ...bulkUpdateGuildChannels, approval: false });
  const { pipeline } = await harness({
    registry,
    policy: new PPolicyEngine([], ["channels"], false),
    makeRequest: async () => json({ message: "Missing Permissions", code: 50013 }, { status: 403 }),
  });
  expect(
    await pipeline.call("discord_bulk_update_guild_channels", {
      guild_id: "200",
      channels: [{ id: "100", position: 0 }],
    }),
  ).toMatchObject({
    ok: false,
    error: {
      category: "permission",
      status: 403,
      discord_code: 50013,
      remediation: "Check the bot permissions; this tool needs ManageChannels",
    },
  });
});
