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

const MEMBER_A = {
  user: { id: "101", username: "alice", bot: false },
  nick: "Ali",
  roles: ["201"],
  joined_at: "2026-01-01T00:00:00.000Z",
};

const MEMBER_B = {
  user: { id: "102", username: "bob", bot: false },
  nick: "Bobby",
  roles: ["202"],
  joined_at: "2026-01-02T00:00:00.000Z",
};

it("lists guild members with query params and next_after cursor", async () => {
  const { client, request } = await harness({
    policy: new PPolicyEngine([], ["members"], false),
    respond: () => [MEMBER_A, MEMBER_B],
  });
  const result = await client.callTool({
    name: "discord_list_guild_members",
    arguments: { guild_id: "123", limit: 2, after: "100" },
  });
  expect(request()).toMatchObject({
    method: "GET",
    url: "https://discord.com/api/v10/guilds/123/members?limit=2&after=100",
  });
  expect(result.structuredContent).toEqual({
    members: [MEMBER_A, MEMBER_B],
    next_after: "102",
  });
});

it("returns next_after null when list is empty", async () => {
  const { client } = await harness({
    policy: new PPolicyEngine([], ["members"], false),
    respond: () => [],
  });
  const result = await client.callTool({
    name: "discord_list_guild_members",
    arguments: { guild_id: "123" },
  });
  expect(result.structuredContent).toEqual({
    members: [],
    next_after: null,
  });
});

it("passes allowlist check when guild is allowed", async () => {
  const { client, request } = await harness({
    policy: new PPolicyEngine(["123"], ["members"], false),
    respond: () => [MEMBER_A],
  });
  const result = await client.callTool({
    name: "discord_list_guild_members",
    arguments: { guild_id: "123" },
  });
  expect(result.structuredContent).toEqual({
    members: [MEMBER_A],
    next_after: "101",
  });
  expect(request()).toMatchObject({
    method: "GET",
    url: "https://discord.com/api/v10/guilds/123/members",
  });
});

it("denies access when guild is not allowed", async () => {
  const { client, makeRequest } = await harness({
    policy: new PPolicyEngine(["999"], ["members"], false),
  });
  const result = await client.callTool({
    name: "discord_list_guild_members",
    arguments: { guild_id: "123" },
  });
  expect(errorOf(result)).toMatchObject({
    category: "policy",
    message: "Guild is not allowed",
  });
  expect(makeRequest).not.toHaveBeenCalled();
});

it.each([
  ["invalid guild_id", { guild_id: "invalid-id" }],
  ["limit < 1", { guild_id: "123", limit: 0 }],
  ["limit > 1000", { guild_id: "123", limit: 1001 }],
])("validates input strictly: %s", async (_, args) => {
  const { client, makeRequest } = await harness({
    policy: new PPolicyEngine([], ["members"], false),
  });
  const result = await client.callTool({
    name: "discord_list_guild_members",
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
  expect(await pipeline.call("discord_list_guild_members", { guild_id: "123" })).toMatchObject({
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
  expect(await pipeline.call("discord_list_guild_members", { guild_id: "123" })).toMatchObject({
    ok: false,
    error: {
      category: "not_found",
      status: 404,
      discord_code: 10004,
      remediation: "Check the IDs in the request",
    },
  });
});
