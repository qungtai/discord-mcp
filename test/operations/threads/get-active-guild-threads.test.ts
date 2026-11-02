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

const THREAD_LIST = {
  threads: [{ id: "101", name: "active-thread", type: 11, guild_id: "200" }],
  members: [{ id: "101", user_id: "999", join_timestamp: "2026-11-03T00:00:00.000Z", flags: 0 }],
};

const threadHarness = (options: Parameters<typeof harness>[0] = {}) =>
  harness({
    ...options,
    policy: options.policy ?? new PPolicyEngine([], ["threads"], false),
  });

it("gets active guild threads", async () => {
  const { client, request } = await threadHarness({
    respond: () => THREAD_LIST,
  });
  const result = await client.callTool({
    name: "discord_get_active_guild_threads",
    arguments: { guild_id: "200" },
  });
  expect(result.structuredContent).toEqual(THREAD_LIST);
  const req = request();
  expect([req.method, req.url]).toEqual([
    "GET",
    "https://discord.com/api/v10/guilds/200/threads/active",
  ]);
});

it("validates guild_id format", async () => {
  const { client, makeRequest } = await threadHarness();
  const result = await client.callTool({
    name: "discord_get_active_guild_threads",
    arguments: { guild_id: "not-snowflake" },
  });
  expect(errorOf(result)).toMatchObject({ category: "validation" });
  expect(makeRequest).not.toHaveBeenCalled();
});

it("handles 403 error", async () => {
  const { client } = await threadHarness({
    makeRequest: async () => json({ message: "Missing Access", code: 50001 }, { status: 403 }),
  });
  const result = await client.callTool({
    name: "discord_get_active_guild_threads",
    arguments: { guild_id: "200" },
  });
  expect(errorOf(result)).toMatchObject({ category: "permission", status: 403 });
});

it("handles 404 error", async () => {
  const { client } = await threadHarness({
    makeRequest: async () => json({ message: "Unknown Guild", code: 10004 }, { status: 404 }),
  });
  const result = await client.callTool({
    name: "discord_get_active_guild_threads",
    arguments: { guild_id: "999" },
  });
  expect(errorOf(result)).toMatchObject({ category: "not_found", status: 404 });
});

it("succeeds under an allowlist containing the guild", async () => {
  const { client, request } = await threadHarness({
    policy: new PPolicyEngine(["200"], ["threads"], false),
    respond: () => THREAD_LIST,
  });
  const result = await client.callTool({
    name: "discord_get_active_guild_threads",
    arguments: { guild_id: "200" },
  });
  expect(result.structuredContent).toEqual(THREAD_LIST);
  expect(request().method).toBe("GET");
});

it("denies guild outside the allowlist", async () => {
  const { client, makeRequest } = await threadHarness({
    policy: new PPolicyEngine(["200"], ["threads"], false),
  });
  const result = await client.callTool({
    name: "discord_get_active_guild_threads",
    arguments: { guild_id: "300" },
  });
  expect(errorOf(result)).toMatchObject({
    category: "policy",
    message: "Guild is not allowed",
  });
  expect(makeRequest).not.toHaveBeenCalled();
});
