import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { PPolicyEngine } from "../../../src/core/policy.js";
import { PToolRegistry } from "../../../src/core/tool-registry.js";
import { unbanUserFromGuild } from "../../../src/operations/moderation/unban-user-from-guild.js";
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
    ...unbanUserFromGuild,
    approval: false,
  });
  return reg;
}

it("unbans a user from a guild with reason header", async () => {
  const { client, request } = await harness({
    registry: optedOutRegistry(),
    policy: new PPolicyEngine([], ["core", "moderation"], false),
    respond: () => undefined,
  });
  const result = await client.callTool({
    name: "discord_unban_user_from_guild",
    arguments: {
      guild_id: "123",
      user_id: "456",
      reason: "appealed successfully",
    },
  });
  expect(result.structuredContent).toEqual({
    unbanned: true,
    guild_id: "123",
    user_id: "456",
  });
  const req = request();
  expect(req.url).toBe("https://discord.com/api/v10/guilds/123/bans/456");
  expect(req.method).toBe("DELETE");
  expect(req.headers).toMatchObject({ "X-Audit-Log-Reason": "appealed%20successfully" });
});

it("rejects invalid user_id", async () => {
  const { client, makeRequest } = await harness({
    registry: optedOutRegistry(),
    policy: new PPolicyEngine([], ["core", "moderation"], false),
  });
  const result = await client.callTool({
    name: "discord_unban_user_from_guild",
    arguments: { guild_id: "123", user_id: "not-a-snowflake" },
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
    name: "discord_unban_user_from_guild",
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
    makeRequest: async () => json({ message: "Unknown Ban", code: 10026 }, { status: 404 }),
  });
  const result = await client.callTool({
    name: "discord_unban_user_from_guild",
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
    name: "discord_unban_user_from_guild",
    arguments: { guild_id: "123", user_id: "456" },
  });
  expect(result.structuredContent).toEqual({
    unbanned: true,
    guild_id: "123",
    user_id: "456",
  });
  expect(request().method).toBe("DELETE");
});

it("denies execution when guild is not in allowlist", async () => {
  const { client, makeRequest } = await harness({
    registry: optedOutRegistry(),
    policy: new PPolicyEngine(["999"], ["core", "moderation"], false),
  });
  const result = await client.callTool({
    name: "discord_unban_user_from_guild",
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
    name: "discord_unban_user_from_guild",
    arguments: { guild_id: "123", user_id: "456" },
  });
  expect(errorOf(result)).toMatchObject({
    category: "policy",
    message: "This tool requires approval support",
    remediation: "Wait for the approval flow",
  });
  expect(makeRequest).not.toHaveBeenCalled();
});
