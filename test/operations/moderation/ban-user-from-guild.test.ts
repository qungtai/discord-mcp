import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { PPolicyEngine } from "../../../src/core/policy.js";
import { PToolRegistry } from "../../../src/core/tool-registry.js";
import { banUserFromGuild } from "../../../src/operations/moderation/ban-user-from-guild.js";
import { errorOf, harness, json } from "../../support/harness.js";

beforeEach(() => {
  vi.spyOn(process.stderr, "write").mockReturnValue(true);
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function optedOutRegistry() {
  const reg = new PToolRegistry();
  reg.register({
    ...banUserFromGuild,
    approval: false,
  });
  return reg;
}

it("bans a user from a guild with delete_message_seconds and reason header", async () => {
  const { client, request } = await harness({
    registry: optedOutRegistry(),
    policy: new PPolicyEngine([], ["core", "moderation"], false),
    respond: () => undefined,
  });
  const result = await client.callTool({
    name: "discord_ban_user_from_guild",
    arguments: {
      guild_id: "123",
      user_id: "456",
      delete_message_seconds: 3600,
      reason: "violated terms",
    },
  });
  expect(result.structuredContent).toEqual({
    banned: true,
    guild_id: "123",
    user_id: "456",
  });
  const req = request();
  expect(req.url).toBe("https://discord.com/api/v10/guilds/123/bans/456");
  expect(req.method).toBe("PUT");
  expect(JSON.parse(String(req.body))).toEqual({ delete_message_seconds: 3600 });
  expect(req.headers).toMatchObject({ "X-Audit-Log-Reason": "violated%20terms" });
});

it("rejects invalid delete_message_seconds", async () => {
  const { client, makeRequest } = await harness({
    registry: optedOutRegistry(),
    policy: new PPolicyEngine([], ["core", "moderation"], false),
  });
  const result = await client.callTool({
    name: "discord_ban_user_from_guild",
    arguments: { guild_id: "123", user_id: "456", delete_message_seconds: 700000 },
  });
  expect(errorOf(result)).toMatchObject({ category: "validation" });
  expect(makeRequest).not.toHaveBeenCalled();
});

it("maps 403 to permission error with BanMembers remediation", async () => {
  const { client } = await harness({
    registry: optedOutRegistry(),
    policy: new PPolicyEngine([], ["core", "moderation"], false),
    makeRequest: async () => json({ message: "Missing Permissions", code: 50013 }, { status: 403 }),
  });
  const result = await client.callTool({
    name: "discord_ban_user_from_guild",
    arguments: { guild_id: "123", user_id: "456" },
  });
  expect(errorOf(result)).toMatchObject({
    category: "permission",
    status: 403,
    remediation: "Check the bot permissions; this tool needs BanMembers",
  });
});

it("maps 404 to not_found error", async () => {
  const { client } = await harness({
    registry: optedOutRegistry(),
    policy: new PPolicyEngine([], ["core", "moderation"], false),
    makeRequest: async () => json({ message: "Unknown User", code: 10013 }, { status: 404 }),
  });
  const result = await client.callTool({
    name: "discord_ban_user_from_guild",
    arguments: { guild_id: "123", user_id: "456" },
  });
  expect(errorOf(result)).toMatchObject({
    category: "not_found",
    status: 404,
  });
});

it("allows execution when guild is in allowlist", async () => {
  const { client, request } = await harness({
    registry: optedOutRegistry(),
    policy: new PPolicyEngine(["123"], ["core", "moderation"], false),
    respond: () => undefined,
  });
  const result = await client.callTool({
    name: "discord_ban_user_from_guild",
    arguments: { guild_id: "123", user_id: "456" },
  });
  expect(result.structuredContent).toEqual({
    banned: true,
    guild_id: "123",
    user_id: "456",
  });
  expect(request().method).toBe("PUT");
});

it("denies execution when guild is not in allowlist", async () => {
  const { client, makeRequest } = await harness({
    registry: optedOutRegistry(),
    policy: new PPolicyEngine(["999"], ["core", "moderation"], false),
  });
  const result = await client.callTool({
    name: "discord_ban_user_from_guild",
    arguments: { guild_id: "123", user_id: "456" },
  });
  expect(errorOf(result)).toMatchObject({
    category: "policy",
    message: "Guild is not allowed",
  });
  expect(makeRequest).not.toHaveBeenCalled();
});

it("denies execution under default approval policy", async () => {
  const { client, makeRequest } = await harness({
    policy: new PPolicyEngine([], ["core", "moderation"], false),
  });
  const result = await client.callTool({
    name: "discord_ban_user_from_guild",
    arguments: { guild_id: "123", user_id: "456" },
  });
  expect(errorOf(result)).toMatchObject({
    category: "policy",
    message: "This tool requires approval support",
    remediation: "Wait for the approval flow",
  });
  expect(makeRequest).not.toHaveBeenCalled();
});
