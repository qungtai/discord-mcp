import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { PPolicyEngine } from "../../../src/core/policy.js";
import { PToolRegistry } from "../../../src/core/tool-registry.js";
import { bulkBanUsersFromGuild } from "../../../src/operations/moderation/bulk-ban-users-from-guild.js";
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
    ...bulkBanUsersFromGuild,
    approval: false,
  });
  return reg;
}

const BULK_RESULT = {
  banned_users: ["11", "12"],
  failed_users: ["13"],
};

it("bulk bans users from a guild with delete_message_seconds and reason header", async () => {
  const { client, request } = await harness({
    registry: optedOutRegistry(),
    policy: new PPolicyEngine([], ["core", "moderation"], false),
    respond: () => BULK_RESULT,
  });
  const result = await client.callTool({
    name: "discord_bulk_ban_users_from_guild",
    arguments: {
      guild_id: "123",
      user_ids: ["11", "12", "13"],
      delete_message_seconds: 7200,
      reason: "raid cleanup",
    },
  });
  expect(result.structuredContent).toEqual(BULK_RESULT);
  const req = request();
  expect(req.url).toBe("https://discord.com/api/v10/guilds/123/bulk-ban");
  expect(req.method).toBe("POST");
  expect(JSON.parse(String(req.body))).toEqual({
    user_ids: ["11", "12", "13"],
    delete_message_seconds: 7200,
  });
  expect(req.headers).toMatchObject({ "X-Audit-Log-Reason": "raid%20cleanup" });
});

it.each([
  [{ guild_id: "invalid", user_ids: ["11"] }],
  [{ guild_id: "123", user_ids: [] }],
  [{ guild_id: "123", user_ids: Array.from({ length: 201 }, (_, i) => String(i + 1)) }],
  [{ guild_id: "123", user_ids: ["invalid"] }],
  [{ guild_id: "123", user_ids: ["11"], delete_message_seconds: -1 }],
  [{ guild_id: "123", user_ids: ["11"], delete_message_seconds: 604801 }],
])("rejects invalid input: %j", async (args) => {
  const { client, makeRequest } = await harness({
    registry: optedOutRegistry(),
    policy: new PPolicyEngine([], ["core", "moderation"], false),
  });
  const result = await client.callTool({
    name: "discord_bulk_ban_users_from_guild",
    arguments: args,
  });
  expect(errorOf(result)).toMatchObject({
    category: "validation",
    message: expect.stringContaining("Invalid input"),
  });
  expect(makeRequest).not.toHaveBeenCalled();
});

it("maps 403 to permission error with BanMembers, ManageGuild remediation and literal message", async () => {
  const { client } = await harness({
    registry: optedOutRegistry(),
    policy: new PPolicyEngine([], ["core", "moderation"], false),
    makeRequest: async () => json({ message: "Missing Permissions", code: 50013 }, { status: 403 }),
  });
  const result = await client.callTool({
    name: "discord_bulk_ban_users_from_guild",
    arguments: { guild_id: "123", user_ids: ["11"] },
  });
  expect(errorOf(result)).toMatchObject({
    category: "permission",
    status: 403,
    message: "Discord rejected the request (HTTP 403): Missing Permissions",
    remediation: "Check the bot permissions; this tool needs BanMembers, ManageGuild",
  });
});

it("maps 404 to not_found error with literal message", async () => {
  const { client } = await harness({
    registry: optedOutRegistry(),
    policy: new PPolicyEngine([], ["core", "moderation"], false),
    makeRequest: async () => json({ message: "Unknown Guild", code: 10004 }, { status: 404 }),
  });
  const result = await client.callTool({
    name: "discord_bulk_ban_users_from_guild",
    arguments: { guild_id: "123", user_ids: ["11"] },
  });
  expect(errorOf(result)).toMatchObject({
    category: "not_found",
    status: 404,
    message: "Discord rejected the request (HTTP 404): Unknown Guild",
  });
});

it("allows execution when guild is in allowlist", async () => {
  const { client, request } = await harness({
    registry: optedOutRegistry(),
    policy: new PPolicyEngine(["123"], ["core", "moderation"], false),
    respond: () => BULK_RESULT,
  });
  const result = await client.callTool({
    name: "discord_bulk_ban_users_from_guild",
    arguments: { guild_id: "123", user_ids: ["11", "12", "13"] },
  });
  expect(result.structuredContent).toEqual(BULK_RESULT);
  expect(request().method).toBe("POST");
});

it("denies execution when guild is not in allowlist", async () => {
  const { client, makeRequest } = await harness({
    registry: optedOutRegistry(),
    policy: new PPolicyEngine(["999"], ["core", "moderation"], false),
  });
  const result = await client.callTool({
    name: "discord_bulk_ban_users_from_guild",
    arguments: { guild_id: "123", user_ids: ["11"] },
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
    name: "discord_bulk_ban_users_from_guild",
    arguments: { guild_id: "123", user_ids: ["11"] },
  });
  expect(errorOf(result)).toMatchObject({
    category: "policy",
    message: "This tool requires approval support",
    remediation: "Wait for the approval flow",
  });
  expect(makeRequest).not.toHaveBeenCalled();
});
