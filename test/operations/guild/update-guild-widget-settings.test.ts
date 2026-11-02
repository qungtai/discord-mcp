import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { PPolicyEngine } from "../../../src/core/policy.js";
import { PToolRegistry } from "../../../src/core/tool-registry.js";
import { errorOf, harness, json } from "../../support/harness.js";

beforeEach(() => {
  vi.spyOn(process.stderr, "write").mockReturnValue(true);
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const WIDGET_SETTINGS = { enabled: true, channel_id: "456" };

it("is gated pending approval support by default", async () => {
  const tool = (await PToolRegistry.load()).get("discord_update_guild_widget_settings");
  expect(tool?.effect).toBe("destructive");
  expect(tool?.approval).toBe(true);

  const { client, makeRequest } = await harness({
    policy: new PPolicyEngine([], ["guild"], false),
  });
  const result = await client.callTool({
    name: "discord_update_guild_widget_settings",
    arguments: { guild_id: "123", enabled: true },
  });
  expect(errorOf(result)).toMatchObject({
    category: "policy",
    message: "This tool requires approval support",
  });
  expect(makeRequest).not.toHaveBeenCalled();
});

it("updates widget settings when approval is bypassed", async () => {
  const base = (await PToolRegistry.load()).get("discord_update_guild_widget_settings");
  if (!base) throw new Error("Missing tool");
  const registry = new PToolRegistry();
  registry.register({ ...base, approval: false });

  const { client, request } = await harness({
    registry,
    policy: new PPolicyEngine([], ["guild"], false),
    respond: () => WIDGET_SETTINGS,
  });
  const result = await client.callTool({
    name: "discord_update_guild_widget_settings",
    arguments: {
      guild_id: "123",
      enabled: true,
      channel_id: "456",
      reason: "widget update",
    },
  });
  expect(result.structuredContent).toEqual({ widget_settings: WIDGET_SETTINGS });
  const req = request();
  expect(req.method).toBe("PATCH");
  expect(req.url).toBe("https://discord.com/api/v10/guilds/123/widget");
  expect(new Headers(req.headers as HeadersInit).get("x-audit-log-reason")).toBe("widget%20update");
  expect(JSON.parse(String(req.body))).toEqual({
    enabled: true,
    channel_id: "456",
  });
});

it("validates channel_id format", async () => {
  const base = (await PToolRegistry.load()).get("discord_update_guild_widget_settings");
  if (!base) throw new Error("Missing tool");
  const registry = new PToolRegistry();
  registry.register({ ...base, approval: false });

  const { client, makeRequest } = await harness({
    registry,
    policy: new PPolicyEngine([], ["guild"], false),
  });
  const result = await client.callTool({
    name: "discord_update_guild_widget_settings",
    arguments: {
      guild_id: "123",
      channel_id: "invalid-snowflake",
    },
  });
  expect(errorOf(result)).toMatchObject({ category: "validation" });
  expect(makeRequest).not.toHaveBeenCalled();
});

it("maps a 403 error to permission with ManageGuild", async () => {
  const base = (await PToolRegistry.load()).get("discord_update_guild_widget_settings");
  if (!base) throw new Error("Missing tool");
  const registry = new PToolRegistry();
  registry.register({ ...base, approval: false });

  const { client } = await harness({
    registry,
    policy: new PPolicyEngine([], ["guild"], false),
    makeRequest: async () => json({ message: "Missing Permissions", code: 50013 }, { status: 403 }),
  });
  const result = await client.callTool({
    name: "discord_update_guild_widget_settings",
    arguments: { guild_id: "123" },
  });
  expect(errorOf(result)).toMatchObject({
    category: "permission",
    status: 403,
    message: "Discord rejected the request (HTTP 403): Missing Permissions",
    remediation: "Check the bot permissions; this tool needs ManageGuild",
  });
});

it("maps a 404 error to not_found", async () => {
  const base = (await PToolRegistry.load()).get("discord_update_guild_widget_settings");
  if (!base) throw new Error("Missing tool");
  const registry = new PToolRegistry();
  registry.register({ ...base, approval: false });

  const { client } = await harness({
    registry,
    policy: new PPolicyEngine([], ["guild"], false),
    makeRequest: async () => json({ message: "Unknown Guild", code: 10004 }, { status: 404 }),
  });
  const result = await client.callTool({
    name: "discord_update_guild_widget_settings",
    arguments: { guild_id: "123" },
  });
  expect(errorOf(result)).toMatchObject({
    category: "not_found",
    status: 404,
    message: "Discord rejected the request (HTTP 404): Unknown Guild",
  });
});

it("allows access when guild and channel are in allowlist", async () => {
  const base = (await PToolRegistry.load()).get("discord_update_guild_widget_settings");
  if (!base) throw new Error("Missing tool");
  const registry = new PToolRegistry();
  registry.register({ ...base, approval: false });

  const { client, request } = await harness({
    registry,
    policy: new PPolicyEngine(["123"], ["guild"], false),
    makeRequest: async (url) => {
      if (String(url).endsWith("/channels/456")) return json({ id: "456", guild_id: "123" });
      return json(WIDGET_SETTINGS);
    },
  });
  const result = await client.callTool({
    name: "discord_update_guild_widget_settings",
    arguments: { guild_id: "123", channel_id: "456" },
  });
  expect(result.structuredContent).toEqual({ widget_settings: WIDGET_SETTINGS });
  expect(request(1).method).toBe("PATCH");
  expect(request(1).url).toBe("https://discord.com/api/v10/guilds/123/widget");
});

it("denies access when guild is not in allowlist", async () => {
  const base = (await PToolRegistry.load()).get("discord_update_guild_widget_settings");
  if (!base) throw new Error("Missing tool");
  const registry = new PToolRegistry();
  registry.register({ ...base, approval: false });

  const { client, makeRequest } = await harness({
    registry,
    policy: new PPolicyEngine(["999"], ["guild"], false),
  });
  const result = await client.callTool({
    name: "discord_update_guild_widget_settings",
    arguments: { guild_id: "123" },
  });
  expect(errorOf(result)).toMatchObject({
    category: "policy",
    message: "Guild is not allowed",
  });
  expect(makeRequest).not.toHaveBeenCalled();
});

it("denies access when channel belongs to another guild", async () => {
  const base = (await PToolRegistry.load()).get("discord_update_guild_widget_settings");
  if (!base) throw new Error("Missing tool");
  const registry = new PToolRegistry();
  registry.register({ ...base, approval: false });

  const { client, makeRequest } = await harness({
    registry,
    policy: new PPolicyEngine(["123"], ["guild"], false),
    makeRequest: async (url) => {
      if (String(url).endsWith("/channels/456")) return json({ id: "456", guild_id: "999" });
      return json(WIDGET_SETTINGS);
    },
  });
  const result = await client.callTool({
    name: "discord_update_guild_widget_settings",
    arguments: { guild_id: "123", channel_id: "456" },
  });
  expect(errorOf(result)).toMatchObject({
    category: "policy",
    message: "Guild is not allowed",
  });
  expect(makeRequest).toHaveBeenCalledTimes(1);
});
