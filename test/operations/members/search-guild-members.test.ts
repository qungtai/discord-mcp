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

const MEMBER_SEARCH = {
  user: { id: "101", username: "alice_wonder", bot: false },
  nick: "Alice",
  roles: ["201"],
  joined_at: "2026-01-01T00:00:00.000Z",
};

it("searches guild members matching query", async () => {
  const { client, request } = await harness({
    policy: new PPolicyEngine([], ["members"], false),
    respond: () => [MEMBER_SEARCH],
  });
  const result = await client.callTool({
    name: "discord_search_guild_members",
    arguments: { guild_id: "123", query: "ali", limit: 5 },
  });
  expect(request()).toMatchObject({
    method: "GET",
    url: "https://discord.com/api/v10/guilds/123/members/search?query=ali&limit=5",
  });
  expect(result.structuredContent).toEqual({
    members: [MEMBER_SEARCH],
  });
});

it("passes allowlist check when guild is allowed", async () => {
  const { client, request } = await harness({
    policy: new PPolicyEngine(["123"], ["members"], false),
    respond: () => [MEMBER_SEARCH],
  });
  const result = await client.callTool({
    name: "discord_search_guild_members",
    arguments: { guild_id: "123", query: "ali" },
  });
  expect(result.structuredContent).toEqual({
    members: [MEMBER_SEARCH],
  });
  expect(request()).toMatchObject({
    method: "GET",
    url: "https://discord.com/api/v10/guilds/123/members/search?query=ali",
  });
});

it("denies access when guild is not allowed", async () => {
  const { client, makeRequest } = await harness({
    policy: new PPolicyEngine(["999"], ["members"], false),
  });
  const result = await client.callTool({
    name: "discord_search_guild_members",
    arguments: { guild_id: "123", query: "ali" },
  });
  expect(errorOf(result)).toMatchObject({
    category: "policy",
    message: "Guild is not allowed",
  });
  expect(makeRequest).not.toHaveBeenCalled();
});

it.each([
  ["empty query", { guild_id: "123", query: "" }],
  ["query over 100 characters", { guild_id: "123", query: "a".repeat(101) }],
  ["limit < 1", { guild_id: "123", query: "ali", limit: 0 }],
  ["limit > 1000", { guild_id: "123", query: "ali", limit: 1001 }],
])("validates input strictly: %s", async (_, args) => {
  const { client, makeRequest } = await harness({
    policy: new PPolicyEngine([], ["members"], false),
  });
  const result = await client.callTool({
    name: "discord_search_guild_members",
    arguments: args,
  });
  expect(errorOf(result)).toMatchObject({ category: "validation" });
  expect(makeRequest).not.toHaveBeenCalled();
});

it("handles 403 error", async () => {
  const { pipeline } = await harness({
    policy: new PPolicyEngine([], ["members"], false),
    makeRequest: async () => json({ message: "Missing Access", code: 50001 }, { status: 403 }),
  });
  expect(
    await pipeline.call("discord_search_guild_members", { guild_id: "123", query: "ali" }),
  ).toMatchObject({
    ok: false,
    error: {
      category: "permission",
      status: 403,
      discord_code: 50001,
      remediation: "Check the bot permissions",
    },
  });
});

it("handles 404 error", async () => {
  const { pipeline } = await harness({
    policy: new PPolicyEngine([], ["members"], false),
    makeRequest: async () => json({ message: "Unknown Guild", code: 10004 }, { status: 404 }),
  });
  expect(
    await pipeline.call("discord_search_guild_members", { guild_id: "123", query: "ali" }),
  ).toMatchObject({
    ok: false,
    error: {
      category: "not_found",
      status: 404,
      discord_code: 10004,
      remediation: "Check the IDs in the request",
    },
  });
});
