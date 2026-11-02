import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { PPolicyEngine } from "../../../src/core/policy.js";
import { errorOf, json } from "../../support/harness.js";
import { SAMPLE_THREAD, setupTestLifecycle, threadHarness } from "./support.js";

beforeEach(setupTestLifecycle);
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const SEARCH_RESULT = {
  threads: [SAMPLE_THREAD],
  members: [],
  has_more: true,
  total_results: 10,
  first_messages: [],
};

it("searches threads in a channel with query filters and next_offset cursor", async () => {
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
  expect(result.structuredContent).toEqual({
    ...SEARCH_RESULT,
    next_offset: 1,
  });
  const req = request();
  expect([req.method, req.url]).toEqual([
    "GET",
    "https://discord.com/api/v10/channels/1/threads/search?name=found&tag=888&tag_setting=match_all&archived=true&sort_by=creation_time&sort_order=desc&limit=10&offset=0",
  ]);
});

it("returns null next_offset when has_more is false", async () => {
  const { client } = await threadHarness({
    respond: () => ({ ...SEARCH_RESULT, has_more: false }),
  });
  const result = await client.callTool({
    name: "discord_thread_search",
    arguments: { channel_id: "1", offset: 5 },
  });
  expect(result.structuredContent).toEqual({
    ...SEARCH_RESULT,
    has_more: false,
    next_offset: null,
  });
});

it("handles 202 SearchIndexNotReady response by returning retryable rate_limited error", async () => {
  const notReady202 = {
    message: "Search index not ready",
    code: 110000,
    documents_indexed: 50,
    retry_after: 3,
  };
  const { client } = await threadHarness({
    respond: () => notReady202,
  });
  const result = await client.callTool({
    name: "discord_thread_search",
    arguments: { channel_id: "1", name: "indexing" },
  });
  expect(errorOf(result)).toMatchObject({
    category: "rate_limited",
    retryable: true,
    remediation: "Index not ready, retry after 3 seconds",
    message: "Search index not ready",
    retry_after: 3,
    discord_code: 110000,
  });
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

it("handles 403 error with literal message", async () => {
  const { client } = await threadHarness({
    makeRequest: async () => json({ message: "Missing Access", code: 50001 }, { status: 403 }),
  });
  const result = await client.callTool({
    name: "discord_thread_search",
    arguments: { channel_id: "1" },
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
    makeRequest: async () => json({ message: "Unknown Channel", code: 10003 }, { status: 404 }),
  });
  const result = await client.callTool({
    name: "discord_thread_search",
    arguments: { channel_id: "999" },
  });
  expect(errorOf(result)).toMatchObject({
    category: "not_found",
    status: 404,
    discord_code: 10003,
    message: "Discord rejected the request (HTTP 404): Unknown Channel",
  });
});

it("succeeds under an allowlist containing the guild with literal routes", async () => {
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
  expect(result.structuredContent).toEqual({
    ...SEARCH_RESULT,
    next_offset: 1,
  });
  expect([request(0).method, request(0).url]).toEqual([
    "GET",
    "https://discord.com/api/v10/channels/1",
  ]);
  expect([request(1).method, request(1).url]).toEqual([
    "GET",
    "https://discord.com/api/v10/channels/1/threads/search",
  ]);
});

it("denies channel in a guild outside the allowlist", async () => {
  const { client, request, makeRequest } = await threadHarness({
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
  expect([request(0).method, request(0).url]).toEqual([
    "GET",
    "https://discord.com/api/v10/channels/1",
  ]);
});
