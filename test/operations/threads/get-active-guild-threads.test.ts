import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { PPolicyEngine } from "../../../src/core/policy.js";
import { errorOf, json } from "../../support/harness.js";
import { SAMPLE_THREAD, setupTestLifecycle, threadHarness } from "./support.js";

beforeEach(setupTestLifecycle);
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const THREAD_LIST = {
  threads: [SAMPLE_THREAD],
  members: [
    {
      id: "101",
      user_id: "999",
      join_timestamp: "2026-11-03T00:00:00.000Z",
      flags: 0,
      member: { user: { id: "999", username: "alice" } },
    },
  ],
  has_more: false,
};

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

it("handles 403 error with literal message", async () => {
  const { client } = await threadHarness({
    makeRequest: async () => json({ message: "Missing Access", code: 50001 }, { status: 403 }),
  });
  const result = await client.callTool({
    name: "discord_get_active_guild_threads",
    arguments: { guild_id: "200" },
  });
  expect(errorOf(result)).toMatchObject({
    category: "permission",
    status: 403,
    discord_code: 50001,
    message: "Discord rejected the request (HTTP 403): Missing Access",
  });
});

it("handles 404 error with literal message", async () => {
  const { client } = await threadHarness({
    makeRequest: async () => json({ message: "Unknown Guild", code: 10004 }, { status: 404 }),
  });
  const result = await client.callTool({
    name: "discord_get_active_guild_threads",
    arguments: { guild_id: "999" },
  });
  expect(errorOf(result)).toMatchObject({
    category: "not_found",
    status: 404,
    discord_code: 10004,
    message: "Discord rejected the request (HTTP 404): Unknown Guild",
  });
});

it("succeeds under an allowlist containing the guild with literal route", async () => {
  const { client, request } = await threadHarness({
    policy: new PPolicyEngine(["200"], ["threads"], false),
    respond: () => THREAD_LIST,
  });
  const result = await client.callTool({
    name: "discord_get_active_guild_threads",
    arguments: { guild_id: "200" },
  });
  expect(result.structuredContent).toEqual(THREAD_LIST);
  expect([request(0).method, request(0).url]).toEqual([
    "GET",
    "https://discord.com/api/v10/guilds/200/threads/active",
  ]);
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
