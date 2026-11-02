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

const MEMBERS = [
  { id: "101", user_id: "501", join_timestamp: "2026-11-03T00:00:00.000Z", flags: 0 },
  { id: "101", user_id: "502", join_timestamp: "2026-11-03T00:00:00.000Z", flags: 0 },
];

const threadHarness = (options: Parameters<typeof harness>[0] = {}) =>
  harness({
    ...options,
    policy: options.policy ?? new PPolicyEngine([], ["threads"], false),
  });

it("lists thread members with query options", async () => {
  const { client, request } = await threadHarness({
    respond: () => MEMBERS,
  });
  const result = await client.callTool({
    name: "discord_list_thread_members",
    arguments: {
      channel_id: "101",
      with_member: true,
      after: "500",
      limit: 50,
    },
  });
  expect(result.structuredContent).toEqual({ members: MEMBERS });
  const req = request();
  expect([req.method, req.url]).toEqual([
    "GET",
    "https://discord.com/api/v10/channels/101/thread-members?with_member=true&after=500&limit=50",
  ]);
});

it("validates channel_id format", async () => {
  const { client, makeRequest } = await threadHarness();
  const result = await client.callTool({
    name: "discord_list_thread_members",
    arguments: { channel_id: "not-snowflake" },
  });
  expect(errorOf(result)).toMatchObject({ category: "validation" });
  expect(makeRequest).not.toHaveBeenCalled();
});

it("handles 403 error", async () => {
  const { client } = await threadHarness({
    makeRequest: async () => json({ message: "Missing Access", code: 50001 }, { status: 403 }),
  });
  const result = await client.callTool({
    name: "discord_list_thread_members",
    arguments: { channel_id: "101" },
  });
  expect(errorOf(result)).toMatchObject({ category: "permission", status: 403 });
});

it("handles 404 error", async () => {
  const { client } = await threadHarness({
    makeRequest: async () => json({ message: "Unknown Channel", code: 10003 }, { status: 404 }),
  });
  const result = await client.callTool({
    name: "discord_list_thread_members",
    arguments: { channel_id: "999" },
  });
  expect(errorOf(result)).toMatchObject({ category: "not_found", status: 404 });
});

it("succeeds under an allowlist containing the guild", async () => {
  const { client, request } = await threadHarness({
    policy: new PPolicyEngine(["200"], ["threads"], false),
    makeRequest: async (url) => {
      if (String(url).endsWith("/channels/101")) {
        return json({ id: "101", guild_id: "200" });
      }
      return json(MEMBERS);
    },
  });
  const result = await client.callTool({
    name: "discord_list_thread_members",
    arguments: { channel_id: "101" },
  });
  expect(result.structuredContent).toEqual({ members: MEMBERS });
  expect(request(1).method).toBe("GET");
});

it("denies channel in a guild outside the allowlist", async () => {
  const { client, makeRequest } = await threadHarness({
    policy: new PPolicyEngine(["200"], ["threads"], false),
    makeRequest: async () => json({ id: "101", guild_id: "300" }),
  });
  const result = await client.callTool({
    name: "discord_list_thread_members",
    arguments: { channel_id: "101" },
  });
  expect(errorOf(result)).toMatchObject({
    category: "policy",
    message: "Guild is not allowed",
  });
  expect(makeRequest).toHaveBeenCalledTimes(1);
});
