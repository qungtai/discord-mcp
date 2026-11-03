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

const ONBOARDING = {
  guild_id: "123",
  prompts: [
    {
      id: "555",
      title: "Select your role",
      options: [{ id: "101", title: "Developer", role_ids: ["201"] }],
    },
  ],
  default_channel_ids: ["789"],
  enabled: true,
  mode: 0,
};

it("puts onboarding after the client accepts approval and preserves response fields", async () => {
  const base = (await PToolRegistry.load()).get("discord_update_guild_onboarding");
  if (!base) throw new Error("Missing tool");
  const registry = new PToolRegistry();
  registry.register(base);

  const { client, request } = await harness({
    registry,
    policy: new PPolicyEngine([], ["guild"], false),
    respond: () => ONBOARDING,
  });
  const result = await client.callTool({
    name: "discord_update_guild_onboarding",
    arguments: {
      guild_id: "123",
      enabled: true,
      default_channel_ids: ["789"],
      prompts: [
        {
          id: "555",
          title: "Select your role",
          options: [{ title: "Developer" }],
        },
      ],
      reason: "onboarding setup",
    },
  });
  expect(result.structuredContent).toEqual({ onboarding: ONBOARDING });
  const req = request();
  expect(req.method).toBe("PUT");
  expect(req.url).toBe("https://discord.com/api/v10/guilds/123/onboarding");
  expect(new Headers(req.headers as HeadersInit).get("x-audit-log-reason")).toBe(
    "onboarding%20setup",
  );
  expect(JSON.parse(String(req.body))).toEqual({
    enabled: true,
    default_channel_ids: ["789"],
    prompts: [
      {
        id: "555",
        title: "Select your role",
        options: [{ title: "Developer" }],
      },
    ],
  });
});

it("validates prompt options min count", async () => {
  const base = (await PToolRegistry.load()).get("discord_update_guild_onboarding");
  if (!base) throw new Error("Missing tool");
  const registry = new PToolRegistry();
  registry.register(base);

  const { client, makeRequest } = await harness({
    registry,
    policy: new PPolicyEngine([], ["guild"], false),
  });
  const result = await client.callTool({
    name: "discord_update_guild_onboarding",
    arguments: {
      guild_id: "123",
      prompts: [{ id: "555", title: "Select", options: [] }],
    },
  });
  expect(errorOf(result)).toMatchObject({ category: "validation" });
  expect(makeRequest).not.toHaveBeenCalled();
});

it("maps a 403 error to permission with ManageGuild", async () => {
  const base = (await PToolRegistry.load()).get("discord_update_guild_onboarding");
  if (!base) throw new Error("Missing tool");
  const registry = new PToolRegistry();
  registry.register(base);

  const { client } = await harness({
    registry,
    policy: new PPolicyEngine([], ["guild"], false),
    makeRequest: async () => json({ message: "Missing Permissions", code: 50013 }, { status: 403 }),
  });
  const result = await client.callTool({
    name: "discord_update_guild_onboarding",
    arguments: { guild_id: "123" },
  });
  expect(errorOf(result)).toMatchObject({
    category: "permission",
    status: 403,
    message: "Discord rejected the request (HTTP 403): Missing Permissions",
    remediation: "Check the bot permissions; this tool needs ManageGuild, ManageRoles",
  });
});

it("maps a 404 error to not_found", async () => {
  const base = (await PToolRegistry.load()).get("discord_update_guild_onboarding");
  if (!base) throw new Error("Missing tool");
  const registry = new PToolRegistry();
  registry.register(base);

  const { client } = await harness({
    registry,
    policy: new PPolicyEngine([], ["guild"], false),
    makeRequest: async () => json({ message: "Unknown Guild", code: 10004 }, { status: 404 }),
  });
  const result = await client.callTool({
    name: "discord_update_guild_onboarding",
    arguments: { guild_id: "123" },
  });
  expect(errorOf(result)).toMatchObject({
    category: "not_found",
    status: 404,
    message: "Discord rejected the request (HTTP 404): Unknown Guild",
  });
});

it("allows access when guild and default channels are in allowlist", async () => {
  const base = (await PToolRegistry.load()).get("discord_update_guild_onboarding");
  if (!base) throw new Error("Missing tool");
  const registry = new PToolRegistry();
  registry.register(base);

  const { client, request } = await harness({
    registry,
    policy: new PPolicyEngine(["123"], ["guild"], false),
    makeRequest: async (url) => {
      if (String(url).endsWith("/channels/789")) return json({ id: "789", guild_id: "123" });
      return json(ONBOARDING);
    },
  });
  const result = await client.callTool({
    name: "discord_update_guild_onboarding",
    arguments: { guild_id: "123", default_channel_ids: ["789"] },
  });
  expect(result.structuredContent).toEqual({ onboarding: ONBOARDING });
  expect(request(1).method).toBe("PUT");
  expect(request(1).url).toBe("https://discord.com/api/v10/guilds/123/onboarding");
});

it("denies access when guild is not in allowlist", async () => {
  const base = (await PToolRegistry.load()).get("discord_update_guild_onboarding");
  if (!base) throw new Error("Missing tool");
  const registry = new PToolRegistry();
  registry.register(base);

  const { client, makeRequest } = await harness({
    registry,
    policy: new PPolicyEngine(["999"], ["guild"], false),
  });
  const result = await client.callTool({
    name: "discord_update_guild_onboarding",
    arguments: { guild_id: "123" },
  });
  expect(errorOf(result)).toMatchObject({
    category: "policy",
    message: "Guild is not allowed",
  });
  expect(makeRequest).not.toHaveBeenCalled();
});

it("denies access when default channel belongs to another guild", async () => {
  const base = (await PToolRegistry.load()).get("discord_update_guild_onboarding");
  if (!base) throw new Error("Missing tool");
  const registry = new PToolRegistry();
  registry.register(base);

  const { client, makeRequest } = await harness({
    registry,
    policy: new PPolicyEngine(["123"], ["guild"], false),
    makeRequest: async (url) => {
      if (String(url).endsWith("/channels/789")) return json({ id: "789", guild_id: "999" });
      return json(ONBOARDING);
    },
  });
  const result = await client.callTool({
    name: "discord_update_guild_onboarding",
    arguments: { guild_id: "123", default_channel_ids: ["789"] },
  });
  expect(errorOf(result)).toMatchObject({
    category: "policy",
    message: "Guild is not allowed",
  });
  expect(makeRequest).toHaveBeenCalledTimes(1);
});
