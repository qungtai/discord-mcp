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

const WELCOME = {
  description: "Updated Welcome",
  welcome_channels: [
    {
      channel_id: "789",
      description: "Chat here",
      emoji_id: null,
      emoji_name: "chat",
    },
  ],
};

it("is gated pending approval support by default", async () => {
  const tool = (await PToolRegistry.load()).get("discord_update_guild_welcome_screen");
  expect(tool?.effect).toBe("destructive");
  expect(tool?.approval).toBe(true);

  const { client, makeRequest } = await harness({
    policy: new PPolicyEngine([], ["guild"], false),
  });
  const result = await client.callTool({
    name: "discord_update_guild_welcome_screen",
    arguments: { guild_id: "123", description: "Updated Welcome" },
  });
  expect(errorOf(result)).toMatchObject({
    category: "policy",
    message: "This tool requires approval support",
  });
  expect(makeRequest).not.toHaveBeenCalled();
});

it("updates welcome screen when approval is bypassed", async () => {
  const base = (await PToolRegistry.load()).get("discord_update_guild_welcome_screen");
  if (!base) throw new Error("Missing tool");
  const registry = new PToolRegistry();
  registry.register({ ...base, approval: false });

  const { client, request } = await harness({
    registry,
    policy: new PPolicyEngine([], ["guild"], false),
    respond: () => WELCOME,
  });
  const result = await client.callTool({
    name: "discord_update_guild_welcome_screen",
    arguments: {
      guild_id: "123",
      description: "Updated Welcome",
      enabled: true,
      welcome_channels: [
        {
          channel_id: "789",
          description: "Chat here",
          emoji_id: null,
          emoji_name: "chat",
        },
      ],
      reason: "screen update",
    },
  });
  expect(result.structuredContent).toEqual({ welcome_screen: WELCOME });
  const req = request();
  expect(req.method).toBe("PATCH");
  expect(req.url).toBe("https://discord.com/api/v10/guilds/123/welcome-screen");
  expect(new Headers(req.headers as HeadersInit).get("x-audit-log-reason")).toBe("screen%20update");
  expect(JSON.parse(String(req.body))).toEqual({
    description: "Updated Welcome",
    enabled: true,
    welcome_channels: [
      {
        channel_id: "789",
        description: "Chat here",
        emoji_id: null,
        emoji_name: "chat",
      },
    ],
  });
});

it("validates welcome channel description min length", async () => {
  const base = (await PToolRegistry.load()).get("discord_update_guild_welcome_screen");
  if (!base) throw new Error("Missing tool");
  const registry = new PToolRegistry();
  registry.register({ ...base, approval: false });

  const { client, makeRequest } = await harness({
    registry,
    policy: new PPolicyEngine([], ["guild"], false),
  });
  const result = await client.callTool({
    name: "discord_update_guild_welcome_screen",
    arguments: {
      guild_id: "123",
      welcome_channels: [{ channel_id: "789", description: "" }],
    },
  });
  expect(errorOf(result)).toMatchObject({ category: "validation" });
  expect(makeRequest).not.toHaveBeenCalled();
});

it("maps a 403 error to permission with ManageGuild", async () => {
  const base = (await PToolRegistry.load()).get("discord_update_guild_welcome_screen");
  if (!base) throw new Error("Missing tool");
  const registry = new PToolRegistry();
  registry.register({ ...base, approval: false });

  const { client } = await harness({
    registry,
    policy: new PPolicyEngine([], ["guild"], false),
    makeRequest: async () => json({ message: "Missing Permissions", code: 50013 }, { status: 403 }),
  });
  const result = await client.callTool({
    name: "discord_update_guild_welcome_screen",
    arguments: { guild_id: "123" },
  });
  expect(errorOf(result)).toMatchObject({
    category: "permission",
    status: 403,
    remediation: "Check the bot permissions; this tool needs ManageGuild",
  });
});

it("maps a 404 error to not_found", async () => {
  const base = (await PToolRegistry.load()).get("discord_update_guild_welcome_screen");
  if (!base) throw new Error("Missing tool");
  const registry = new PToolRegistry();
  registry.register({ ...base, approval: false });

  const { client } = await harness({
    registry,
    policy: new PPolicyEngine([], ["guild"], false),
    makeRequest: async () => json({ message: "Unknown Guild", code: 10004 }, { status: 404 }),
  });
  const result = await client.callTool({
    name: "discord_update_guild_welcome_screen",
    arguments: { guild_id: "123" },
  });
  expect(errorOf(result)).toMatchObject({ category: "not_found", status: 404 });
});

it("allows access when guild is in allowlist", async () => {
  const base = (await PToolRegistry.load()).get("discord_update_guild_welcome_screen");
  if (!base) throw new Error("Missing tool");
  const registry = new PToolRegistry();
  registry.register({ ...base, approval: false });

  const { client, request } = await harness({
    registry,
    policy: new PPolicyEngine(["123"], ["guild"], false),
    respond: () => WELCOME,
  });
  const result = await client.callTool({
    name: "discord_update_guild_welcome_screen",
    arguments: { guild_id: "123" },
  });
  expect(result.structuredContent).toEqual({ welcome_screen: WELCOME });
  expect(request().method).toBe("PATCH");
});

it("denies access when guild is not in allowlist", async () => {
  const base = (await PToolRegistry.load()).get("discord_update_guild_welcome_screen");
  if (!base) throw new Error("Missing tool");
  const registry = new PToolRegistry();
  registry.register({ ...base, approval: false });

  const { client, makeRequest } = await harness({
    registry,
    policy: new PPolicyEngine(["999"], ["guild"], false),
  });
  const result = await client.callTool({
    name: "discord_update_guild_welcome_screen",
    arguments: { guild_id: "123" },
  });
  expect(errorOf(result)).toMatchObject({
    category: "policy",
    message: "Guild is not allowed",
  });
  expect(makeRequest).not.toHaveBeenCalled();
});
