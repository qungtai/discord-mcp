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

const MEMBER = {
  user: { id: "456", username: "charlie", bot: false },
  nick: "Chuck",
  roles: ["301", "302"],
  joined_at: "2026-01-01T00:00:00.000Z",
};

it("gets a guild member by user ID", async () => {
  const { client, request } = await harness({
    policy: new PPolicyEngine([], ["members"], false),
    respond: () => MEMBER,
  });
  const result = await client.callTool({
    name: "discord_get_guild_member",
    arguments: { guild_id: "123", user_id: "456" },
  });
  expect(request()).toMatchObject({
    method: "GET",
    url: "https://discord.com/api/v10/guilds/123/members/456",
  });
  expect(result.structuredContent).toEqual({
    member: MEMBER,
  });
});

it("passes allowlist check when guild is allowed", async () => {
  const { client, request } = await harness({
    policy: new PPolicyEngine(["123"], ["members"], false),
    respond: () => MEMBER,
  });
  const result = await client.callTool({
    name: "discord_get_guild_member",
    arguments: { guild_id: "123", user_id: "456" },
  });
  expect(result.structuredContent).toEqual({
    member: MEMBER,
  });
  expect(request()).toMatchObject({
    method: "GET",
    url: "https://discord.com/api/v10/guilds/123/members/456",
  });
});

it("denies access when guild is not allowed", async () => {
  const { client, makeRequest } = await harness({
    policy: new PPolicyEngine(["999"], ["members"], false),
  });
  const result = await client.callTool({
    name: "discord_get_guild_member",
    arguments: { guild_id: "123", user_id: "456" },
  });
  expect(errorOf(result)).toMatchObject({
    category: "policy",
    message: "Guild is not allowed",
  });
  expect(makeRequest).not.toHaveBeenCalled();
});

it.each([
  ["invalid guild_id", { guild_id: "invalid", user_id: "456" }],
  ["invalid user_id", { guild_id: "123", user_id: "invalid" }],
])("validates input strictly: %s", async (_, args) => {
  const { client, makeRequest } = await harness({
    policy: new PPolicyEngine([], ["members"], false),
  });
  const result = await client.callTool({
    name: "discord_get_guild_member",
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
    await pipeline.call("discord_get_guild_member", { guild_id: "123", user_id: "456" }),
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
    makeRequest: async () => json({ message: "Unknown Member", code: 10007 }, { status: 404 }),
  });
  expect(
    await pipeline.call("discord_get_guild_member", { guild_id: "123", user_id: "456" }),
  ).toMatchObject({
    ok: false,
    error: {
      category: "not_found",
      status: 404,
      discord_code: 10007,
      remediation: "Check the IDs in the request",
    },
  });
});
