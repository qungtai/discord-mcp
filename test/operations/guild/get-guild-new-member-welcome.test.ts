import type { ResponseLike } from "@discordjs/rest";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { PPolicyEngine } from "../../../src/core/policy.js";
import { errorOf, harness, json } from "../../support/harness.js";

beforeEach(() => {
  vi.spyOn(process.stderr, "write").mockReturnValue(true);
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const WELCOME = {
  guild_id: "123",
  enabled: true,
  welcome_message: { author_ids: ["999"], message: "Welcome!" },
  new_member_actions: [{ action_type: 0, title: "Say hi" }],
  resource_channels: [{ channel_id: "456", title: "Rules" }],
};

it("gets new member welcome settings and retains loose fields", async () => {
  const { client, request } = await harness({
    policy: new PPolicyEngine([], ["guild"], false),
    respond: () => WELCOME,
  });
  const result = await client.callTool({
    name: "discord_get_guild_new_member_welcome",
    arguments: { guild_id: "123" },
  });
  expect(request().method).toBe("GET");
  expect(request().url).toBe("https://discord.com/api/v10/guilds/123/new-member-welcome");
  expect(result.structuredContent).toEqual({ new_member_welcome: WELCOME });
});

it("handles 204 / null new member welcome response", async () => {
  const { client } = await harness({
    policy: new PPolicyEngine([], ["guild"], false),
    makeRequest: async () => new Response(null, { status: 204 }) as unknown as ResponseLike,
  });
  const result = await client.callTool({
    name: "discord_get_guild_new_member_welcome",
    arguments: { guild_id: "123" },
  });
  expect(result.structuredContent).toEqual({ new_member_welcome: null });
});

it("validates guild_id format", async () => {
  const { client, makeRequest } = await harness({
    policy: new PPolicyEngine([], ["guild"], false),
  });
  const result = await client.callTool({
    name: "discord_get_guild_new_member_welcome",
    arguments: { guild_id: "invalid" },
  });
  expect(errorOf(result)).toMatchObject({
    category: "validation",
    message: expect.stringContaining("Expected a Discord snowflake"),
  });
  expect(makeRequest).not.toHaveBeenCalled();
});

it("maps a 403 error to permission with ManageGuild remediation", async () => {
  const { client } = await harness({
    policy: new PPolicyEngine([], ["guild"], false),
    makeRequest: async () => json({ message: "Missing Permissions", code: 50013 }, { status: 403 }),
  });
  const result = await client.callTool({
    name: "discord_get_guild_new_member_welcome",
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
  const { client } = await harness({
    policy: new PPolicyEngine([], ["guild"], false),
    makeRequest: async () => json({ message: "Unknown Guild", code: 10004 }, { status: 404 }),
  });
  const result = await client.callTool({
    name: "discord_get_guild_new_member_welcome",
    arguments: { guild_id: "123" },
  });
  expect(errorOf(result)).toMatchObject({
    category: "not_found",
    status: 404,
    message: "Discord rejected the request (HTTP 404): Unknown Guild",
  });
});

it("allows access when guild is in allowlist", async () => {
  const { client, request } = await harness({
    policy: new PPolicyEngine(["123"], ["guild"], false),
    respond: () => WELCOME,
  });
  const result = await client.callTool({
    name: "discord_get_guild_new_member_welcome",
    arguments: { guild_id: "123" },
  });
  expect(result.structuredContent).toEqual({ new_member_welcome: WELCOME });
  expect(request().method).toBe("GET");
  expect(request().url).toBe("https://discord.com/api/v10/guilds/123/new-member-welcome");
});

it("denies access when guild is not in allowlist", async () => {
  const { client, makeRequest } = await harness({
    policy: new PPolicyEngine(["999"], ["guild"], false),
  });
  const result = await client.callTool({
    name: "discord_get_guild_new_member_welcome",
    arguments: { guild_id: "123" },
  });
  expect(errorOf(result)).toMatchObject({
    category: "policy",
    message: "Guild is not allowed",
  });
  expect(makeRequest).not.toHaveBeenCalled();
});
