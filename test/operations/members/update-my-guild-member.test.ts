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

const BOT_MEMBER = {
  user: { id: "999", username: "bot", bot: true },
  nick: "Friendly Bot",
  roles: [],
  joined_at: "2026-01-01T00:00:00.000Z",
};

it("updates the current bot member in a guild", async () => {
  const { client, request } = await harness({
    policy: new PPolicyEngine([], ["members"], false),
    respond: () => BOT_MEMBER,
  });
  const result = await client.callTool({
    name: "discord_update_my_guild_member",
    arguments: {
      guild_id: "123",
      nick: "Friendly Bot",
      bio: "I am a helpful assistant",
      reason: "Updating profile",
    },
  });
  const req = request();
  expect(req.method).toBe("PATCH");
  expect(req.url).toBe("https://discord.com/api/v10/guilds/123/members/%40me");
  expect(new Headers(req.headers as HeadersInit).get("x-audit-log-reason")).toBe(
    encodeURIComponent("Updating profile"),
  );
  expect(JSON.parse(String(req.body))).toEqual({
    nick: "Friendly Bot",
    bio: "I am a helpful assistant",
  });
  expect(result.structuredContent).toEqual({
    member: BOT_MEMBER,
  });
});

it("passes allowlist check when guild is allowed", async () => {
  const { client, request } = await harness({
    policy: new PPolicyEngine(["123"], ["members"], false),
    respond: () => BOT_MEMBER,
  });
  const result = await client.callTool({
    name: "discord_update_my_guild_member",
    arguments: { guild_id: "123", nick: "Friendly Bot" },
  });
  expect(result.structuredContent).toEqual({ member: BOT_MEMBER });
  expect(request()).toMatchObject({
    method: "PATCH",
    url: "https://discord.com/api/v10/guilds/123/members/%40me",
  });
});

it("denies access when guild is not allowed", async () => {
  const { client, makeRequest } = await harness({
    policy: new PPolicyEngine(["999"], ["members"], false),
  });
  const result = await client.callTool({
    name: "discord_update_my_guild_member",
    arguments: { guild_id: "123", nick: "Friendly Bot" },
  });
  expect(errorOf(result)).toMatchObject({
    category: "policy",
    message: "Guild is not allowed",
  });
  expect(makeRequest).not.toHaveBeenCalled();
});

it("blocks execution in read-only mode", async () => {
  const { pipeline, makeRequest } = await harness({
    policy: new PPolicyEngine([], ["members"], true),
  });
  const result = await pipeline.call("discord_update_my_guild_member", {
    guild_id: "123",
    nick: "Friendly Bot",
  });
  expect(result).toMatchObject({
    error: { category: "policy", message: "Read-only mode" },
  });
  expect(makeRequest).not.toHaveBeenCalled();
});

it.each([
  ["nick > 32 chars", { guild_id: "123", nick: "a".repeat(33) }],
  ["bio > 300 chars", { guild_id: "123", bio: "b".repeat(301) }],
])("validates input strictly: %s", async (_, args) => {
  const { client, makeRequest } = await harness({
    policy: new PPolicyEngine([], ["members"], false),
  });
  const result = await client.callTool({
    name: "discord_update_my_guild_member",
    arguments: args,
  });
  expect(errorOf(result)).toMatchObject({ category: "validation" });
  expect(makeRequest).not.toHaveBeenCalled();
});

it("handles 403 missing permissions error", async () => {
  const { pipeline } = await harness({
    policy: new PPolicyEngine([], ["members"], false),
    makeRequest: async () => json({ message: "Missing Permissions", code: 50013 }, { status: 403 }),
  });
  expect(
    await pipeline.call("discord_update_my_guild_member", {
      guild_id: "123",
      nick: "Friendly Bot",
    }),
  ).toMatchObject({
    ok: false,
    error: {
      category: "permission",
      status: 403,
      discord_code: 50013,
      remediation: "Check the bot permissions; this tool needs ChangeNickname",
    },
  });
});

it("handles 404 error", async () => {
  const { pipeline } = await harness({
    policy: new PPolicyEngine([], ["members"], false),
    makeRequest: async () => json({ message: "Unknown Guild", code: 10004 }, { status: 404 }),
  });
  expect(
    await pipeline.call("discord_update_my_guild_member", {
      guild_id: "123",
      nick: "Friendly Bot",
    }),
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
