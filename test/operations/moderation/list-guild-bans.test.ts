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

it("lists bans with query parameters and pagination cursors", async () => {
  const ban2 = { user: { id: "101", username: "troll" }, reason: "trolling" };
  const { client, request } = await harness({
    policy: new PPolicyEngine([], ["core", "moderation"], false),
    respond: () => [BAN, ban2],
  });
  const result = await client.callTool({
    name: "discord_list_guild_bans",
    arguments: { guild_id: "123", limit: 50, before: "200" },
  });
  expect(request().url).toBe("https://discord.com/api/v10/guilds/123/bans?limit=50&before=200");
  expect(request().method).toBe("GET");
  expect(result.structuredContent).toEqual({
    bans: [BAN, ban2],
    next_before: "101",
    next_after: "100",
  });
});

it("rejects invalid input", async () => {
  const { client, makeRequest } = await harness({
    policy: new PPolicyEngine([], ["core", "moderation"], false),
  });
  const result = await client.callTool({
    name: "discord_list_guild_bans",
    arguments: { guild_id: "not-a-snowflake" },
  });
  expect(errorOf(result)).toMatchObject({ category: "validation" });
  expect(makeRequest).not.toHaveBeenCalled();
});

it("maps 403 to permission error with BanMembers remediation", async () => {
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
    remediation: "Check the bot permissions; this tool needs BanMembers",
  });
});

it("maps 404 to not_found error", async () => {
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
    next_before: "100",
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
