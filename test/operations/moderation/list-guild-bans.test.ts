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
  user: { id: "100", username: "baduser" },
  reason: "spamming",
};

it("lists bans with query parameters and pagination cursors in ascending user ID order", async () => {
  const ban2 = { user: { id: "101", username: "troll" }, reason: "trolling" };
  const { client, request } = await harness({
    policy: new PPolicyEngine([], ["core", "moderation"], false),
    respond: () => [BAN, ban2],
  });
  const result = await client.callTool({
    name: "discord_list_guild_bans",
    arguments: { guild_id: "123", limit: 50, before: "200", after: "50" },
  });
  expect(request().url).toBe(
    "https://discord.com/api/v10/guilds/123/bans?limit=50&before=200&after=50",
  );
  expect(request().method).toBe("GET");
  expect(result.structuredContent).toEqual({
    bans: [BAN, ban2],
    next_after: "101",
  });
});

it("returns null next_after on an empty page of bans", async () => {
  const { client, request } = await harness({
    policy: new PPolicyEngine([], ["core", "moderation"], false),
    respond: () => [],
  });
  const result = await client.callTool({
    name: "discord_list_guild_bans",
    arguments: { guild_id: "123" },
  });
  expect(request().method).toBe("GET");
  expect(result.structuredContent).toEqual({
    bans: [],
    next_after: null,
  });
});

it.each([
  [{ guild_id: "not-a-snowflake" }],
  [{ guild_id: "123", limit: 0 }],
  [{ guild_id: "123", limit: 1001 }],
  [{ guild_id: "123", before: "invalid" }],
  [{ guild_id: "123", after: "invalid" }],
])("rejects invalid input: %j", async (args) => {
  const { client, makeRequest } = await harness({
    policy: new PPolicyEngine([], ["core", "moderation"], false),
  });
  const result = await client.callTool({
    name: "discord_list_guild_bans",
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
    name: "discord_list_guild_bans",
    arguments: { guild_id: "123" },
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
    makeRequest: async () => json({ message: "Unknown Guild", code: 10004 }, { status: 404 }),
  });
  const result = await client.callTool({
    name: "discord_list_guild_bans",
    arguments: { guild_id: "123" },
  });
  expect(errorOf(result)).toMatchObject({
    category: "not_found",
    status: 404,
    message: "Discord rejected the request (HTTP 404): Unknown Guild",
  });
});

it("allows execution when guild is in allowlist", async () => {
  const { client, request } = await harness({
    policy: new PPolicyEngine(["123"], ["core", "moderation"], false),
    respond: () => [BAN],
  });
  const result = await client.callTool({
    name: "discord_list_guild_bans",
    arguments: { guild_id: "123" },
  });
  expect(result.structuredContent).toEqual({
    bans: [BAN],
    next_after: "100",
  });
  expect(request().method).toBe("GET");
});

it("denies execution when guild is not in allowlist", async () => {
  const { client, makeRequest } = await harness({
    policy: new PPolicyEngine(["999"], ["core", "moderation"], false),
  });
  const result = await client.callTool({
    name: "discord_list_guild_bans",
    arguments: { guild_id: "123" },
  });
  expect(errorOf(result)).toMatchObject({
    category: "policy",
    message: "Guild is not allowed",
  });
  expect(makeRequest).not.toHaveBeenCalled();
});
