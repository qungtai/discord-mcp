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

const BAN = {
  user: { id: "456", username: "targetuser" },
  reason: "breaking rules",
};

it("gets ban for a specific user in a guild", async () => {
  const { client, request } = await harness({
    policy: new PPolicyEngine([], ["core", "moderation"], false),
    respond: () => BAN,
  });
  const result = await client.callTool({
    name: "discord_get_guild_ban",
    arguments: { guild_id: "123", user_id: "456" },
  });
  expect(request().url).toBe("https://discord.com/api/v10/guilds/123/bans/456");
  expect(request().method).toBe("GET");
  expect(result.structuredContent).toEqual({ ban: BAN });
});

it.each([
  [{ guild_id: "invalid", user_id: "456" }],
  [{ guild_id: "123", user_id: "invalid" }],
  [{ guild_id: "123" }],
])("rejects invalid input: %j", async (args) => {
  const { client, makeRequest } = await harness({
    policy: new PPolicyEngine([], ["core", "moderation"], false),
  });
  const result = await client.callTool({
    name: "discord_get_guild_ban",
    arguments: args,
  });
  expect(errorOf(result)).toMatchObject({
    category: "validation",
    message: expect.stringContaining("Invalid input"),
  });
  expect(makeRequest).not.toHaveBeenCalled();
});

it("maps 403 to permission error with BanMembers remediation and literal message", async () => {
  const { client } = await harness({
    policy: new PPolicyEngine([], ["core", "moderation"], false),
    makeRequest: async () => json({ message: "Missing Permissions", code: 50013 }, { status: 403 }),
  });
  const result = await client.callTool({
    name: "discord_get_guild_ban",
    arguments: { guild_id: "123", user_id: "456" },
  });
  expect(errorOf(result)).toMatchObject({
    category: "permission",
    status: 403,
    message: "Discord rejected the request (HTTP 403): Missing Permissions",
    remediation: "Check the bot permissions; this tool needs BanMembers",
  });
});

it("maps 404 to not_found error with literal message", async () => {
  const { client } = await harness({
    policy: new PPolicyEngine([], ["core", "moderation"], false),
    makeRequest: async () => json({ message: "Unknown Ban", code: 10026 }, { status: 404 }),
  });
  const result = await client.callTool({
    name: "discord_get_guild_ban",
    arguments: { guild_id: "123", user_id: "456" },
  });
  expect(errorOf(result)).toMatchObject({
    category: "not_found",
    status: 404,
    message: "Discord rejected the request (HTTP 404): Unknown Ban",
  });
});

it("allows execution when guild is in allowlist", async () => {
  const { client, request } = await harness({
    policy: new PPolicyEngine(["123"], ["core", "moderation"], false),
    respond: () => BAN,
  });
  const result = await client.callTool({
    name: "discord_get_guild_ban",
    arguments: { guild_id: "123", user_id: "456" },
  });
  expect(result.structuredContent).toEqual({ ban: BAN });
  expect(request().method).toBe("GET");
});

it("denies execution when guild is not in allowlist", async () => {
  const { client, makeRequest } = await harness({
    policy: new PPolicyEngine(["999"], ["core", "moderation"], false),
  });
  const result = await client.callTool({
    name: "discord_get_guild_ban",
    arguments: { guild_id: "123", user_id: "456" },
  });
  expect(errorOf(result)).toMatchObject({
    category: "policy",
    message: "Guild is not allowed",
  });
  expect(makeRequest).not.toHaveBeenCalled();
});
