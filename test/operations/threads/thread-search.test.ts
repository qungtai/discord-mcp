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

const SEARCH_RESULT = {
  threads: [{ id: "101", name: "found-thread", type: 11, guild_id: "200" }],
  members: [],
  has_more: false,
  total_results: 1,
  first_messages: [],
};

const threadHarness = (options: Parameters<typeof harness>[0] = {}) =>
  harness({
    ...options,
    policy: options.policy ?? new PPolicyEngine([], ["threads"], false),
  });

it("searches threads in a channel with query filters", async () => {
  const { client, request } = await threadHarness({
    respond: () => SEARCH_RESULT,
  });
  const result = await client.callTool({
    name: "discord_thread_search",
    arguments: {
      channel_id: "1",
      name: "found",
      archived: true,
      sort_by: "creation_time",
      sort_order: "desc",
      limit: 10,
      offset: 0,
      tag: "888",
      tag_setting: "match_all",
    },
  });
  expect(result.structuredContent).toEqual(SEARCH_RESULT);
  const req = request();
  expect([req.method, req.url]).toEqual([
    "GET",
    "https://discord.com/api/v10/channels/1/threads/search?name=found&tag=888&tag_setting=match_all&archived=true&sort_by=creation_time&sort_order=desc&limit=10&offset=0",
  ]);
});

it("validates limit range (min 1, max 25)", async () => {
  const { client, makeRequest } = await threadHarness();
  const result = await client.callTool({
    name: "discord_thread_search",
    arguments: { channel_id: "1", limit: 30 },
  });
  expect(errorOf(result)).toMatchObject({ category: "validation" });
  expect(makeRequest).not.toHaveBeenCalled();
});

it("handles 403 error", async () => {
  const { client } = await threadHarness({
    makeRequest: async () => json({ message: "Missing Access", code: 50001 }, { status: 403 }),
  });
  const result = await client.callTool({
    name: "discord_thread_search",
    arguments: { channel_id: "1" },
  });
  expect(errorOf(result)).toMatchObject({ category: "permission", status: 403 });
});

it("handles 404 error", async () => {
  const { client } = await threadHarness({
    makeRequest: async () => json({ message: "Unknown Channel", code: 10003 }, { status: 404 }),
  });
  const result = await client.callTool({
    name: "discord_thread_search",
    arguments: { channel_id: "999" },
  });
  expect(errorOf(result)).toMatchObject({ category: "not_found", status: 404 });
});

it("succeeds under an allowlist containing the guild", async () => {
  const { client, request } = await threadHarness({
    policy: new PPolicyEngine(["200"], ["threads"], false),
    makeRequest: async (url) => {
      if (String(url).endsWith("/channels/1")) {
        return json({ id: "1", guild_id: "200" });
      }
      return json(SEARCH_RESULT);
    },
  });
  const result = await client.callTool({
    name: "discord_thread_search",
    arguments: { channel_id: "1" },
  });
  expect(result.structuredContent).toEqual(SEARCH_RESULT);
  expect(request(1).method).toBe("GET");
});

it("denies channel in a guild outside the allowlist", async () => {
  const { client, makeRequest } = await threadHarness({
    policy: new PPolicyEngine(["200"], ["threads"], false),
    makeRequest: async () => json({ id: "1", guild_id: "300" }),
  });
  const result = await client.callTool({
    name: "discord_thread_search",
    arguments: { channel_id: "1" },
  });
  expect(errorOf(result)).toMatchObject({
    category: "policy",
    message: "Guild is not allowed",
  });
  expect(makeRequest).toHaveBeenCalledTimes(1);
});
