import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { PPolicyEngine } from "../../../src/core/policy.js";
import { errorOf, harness, json, MESSAGE } from "../../support/harness.js";

beforeEach(() => {
  vi.spyOn(process.stderr, "write").mockReturnValue(true);
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const THREAD = {
  id: "201",
  name: "search-thread",
  type: 11,
};

const THREAD_MEMBER = {
  id: "201",
  user_id: "9",
  join_timestamp: "2026-11-03T00:00:00.000Z",
  flags: 0,
  member: {
    nick: "tester",
    roles: ["301"],
  },
};

const SEARCH_RESPONSE = {
  messages: [[MESSAGE]],
  total_results: 1,
  threads: [THREAD],
  members: [THREAD_MEMBER],
  doing_deep_historical_index: false,
  documents_indexed: 50,
};

it("searches guild messages with query parameters and parses structured output with next_offset", async () => {
  const { client, request } = await harness({ respond: () => SEARCH_RESPONSE });
  const result = await client.callTool({
    name: "discord_search_guild_messages",
    arguments: {
      guild_id: "123",
      sort_by: "timestamp",
      sort_order: "desc",
      content: "test",
      slop: 2,
      author_id: ["10", "20"],
      author_type: ["user", "bot"],
      limit: 10,
      offset: 0,
      has: ["link", "file"],
      embed_type: ["image"],
      pinned: true,
      include_nsfw: false,
      mention_everyone: true,
      channel_id: ["100", "200"],
    },
  });

  const req = request();
  expect(req.method).toBe("GET");
  expect(req.url).toBe(
    "https://discord.com/api/v10/guilds/123/messages/search?" +
      "sort_by=timestamp&sort_order=desc&content=test&slop=2&author_id=10&author_id=20&" +
      "author_type=user&author_type=bot&mention_everyone=true&limit=10&offset=0&" +
      "has=link&has=file&embed_type=image&pinned=true&include_nsfw=false&" +
      "channel_id=100&channel_id=200",
  );
  expect(result.structuredContent).toEqual({
    ...SEARCH_RESPONSE,
    next_offset: null,
  });
});

it("computes next_offset from the results returned when more remain", async () => {
  const { client } = await harness({
    respond: () => ({ ...SEARCH_RESPONSE, total_results: 25 }),
  });
  const result = await client.callTool({
    name: "discord_search_guild_messages",
    arguments: { guild_id: "123", limit: 10, offset: 0 },
  });
  expect(result.structuredContent).toMatchObject({
    total_results: 25,
    next_offset: 1,
  });
});

it("asserts remaining query parameters in URL", async () => {
  const { client, request } = await harness({ respond: () => SEARCH_RESPONSE });
  await client.callTool({
    name: "discord_search_guild_messages",
    arguments: {
      guild_id: "123",
      mentions: ["401"],
      mentions_role_id: ["402"],
      replied_to_user_id: ["403"],
      replied_to_message_id: ["404"],
      min_id: "405",
      max_id: "406",
      link_hostname: ["example.com"],
      embed_provider: ["YouTube"],
      attachment_extension: ["png"],
      attachment_filename: ["image.png"],
    },
  });

  const req = request();
  expect(req.method).toBe("GET");
  expect(req.url).toBe(
    "https://discord.com/api/v10/guilds/123/messages/search?" +
      "mentions=401&mentions_role_id=402&replied_to_user_id=403&replied_to_message_id=404&" +
      "min_id=405&max_id=406&link_hostname=example.com&embed_provider=YouTube&" +
      "attachment_extension=png&attachment_filename=image.png",
  );
});

it("handles 202 response when search index is not ready", async () => {
  const notReady = {
    message: "Index not ready",
    code: 110000,
    documents_indexed: 12,
    retry_after: 5,
  };
  const { client } = await harness({
    makeRequest: async () => json(notReady, { status: 202 }),
  });
  const result = await client.callTool({
    name: "discord_search_guild_messages",
    arguments: { guild_id: "123" },
  });

  expect(errorOf(result)).toMatchObject({
    category: "rate_limited",
    retryable: true,
    retry_after: 5,
    message: "Index not ready",
    remediation: "The search index is still being built; retry after 5 seconds",
    discord_code: 110000,
  });
});

it("maps a 403 to permission error with required permissions", async () => {
  const { client } = await harness({
    makeRequest: async () => json({ message: "Missing Permissions", code: 50013 }, { status: 403 }),
  });
  const result = await client.callTool({
    name: "discord_search_guild_messages",
    arguments: { guild_id: "123" },
  });
  expect(errorOf(result)).toMatchObject({
    category: "permission",
    retryable: false,
    status: 403,
    discord_code: 50013,
    remediation: "Check the bot permissions; this tool needs ViewChannel, ReadMessageHistory",
  });
});

it("maps a 404 to not_found error", async () => {
  const { client } = await harness({
    makeRequest: async () => json({ message: "Unknown Guild", code: 10004 }, { status: 404 }),
  });
  const result = await client.callTool({
    name: "discord_search_guild_messages",
    arguments: { guild_id: "999" },
  });
  expect(errorOf(result)).toMatchObject({
    category: "not_found",
    retryable: false,
    status: 404,
    remediation: "Check the IDs in the request",
  });
});

it.each([
  ["limit > 25", { guild_id: "123", limit: 26 }, "limit"],
  ["offset > 9975", { guild_id: "123", offset: 9976 }, "offset"],
  ["slop > 100", { guild_id: "123", slop: 101 }, "slop"],
  ["non-snowflake author_id", { guild_id: "123", author_id: ["not-a-snowflake"] }, "author_id"],
  ["invalid enum sort_by", { guild_id: "123", sort_by: "invalid" }, "sort_by"],
  ["invalid enum author_type", { guild_id: "123", author_type: ["invalid"] }, "author_type"],
  ["invalid enum has", { guild_id: "123", has: ["invalid"] }, "has"],
  ["invalid enum embed_type", { guild_id: "123", embed_type: ["invalid"] }, "embed_type"],
  ["unknown input key", { guild_id: "123", extra_field: "foo" }, "input"],
])("rejects validation rule for %s", async (_, args, field) => {
  const { client, makeRequest } = await harness();
  const result = await client.callTool({
    name: "discord_search_guild_messages",
    arguments: args,
  });
  expect(errorOf(result)).toMatchObject({
    category: "validation",
  });
  expect(errorOf(result).message).toContain(field);
  expect(makeRequest).not.toHaveBeenCalled();
});

it("allows search when all channels and guild are in allowed guilds", async () => {
  const { client, request } = await harness({
    policy: new PPolicyEngine(["123"], ["messages"], false),
    makeRequest: async (url) => {
      const u = String(url);
      if (u.includes("/channels/100")) return json({ id: "100", guild_id: "123" });
      if (u.includes("/channels/200")) return json({ id: "200", guild_id: "123" });
      return json(SEARCH_RESPONSE);
    },
  });
  const result = await client.callTool({
    name: "discord_search_guild_messages",
    arguments: { guild_id: "123", channel_id: ["100", "200"] },
  });
  expect(result.structuredContent).toEqual({
    ...SEARCH_RESPONSE,
    next_offset: null,
  });
  expect(request(2).url).toBe(
    "https://discord.com/api/v10/guilds/123/messages/search?channel_id=100&channel_id=200",
  );
});

it("blocks search when a channel_id is in another guild outside the allowlist", async () => {
  const { client, makeRequest } = await harness({
    policy: new PPolicyEngine(["123"], ["messages"], false),
    makeRequest: async (url) => {
      const u = String(url);
      if (u.includes("/channels/100")) return json({ id: "100", guild_id: "123" });
      if (u.includes("/channels/999")) return json({ id: "999", guild_id: "456" });
      return json(SEARCH_RESPONSE);
    },
  });
  const result = await client.callTool({
    name: "discord_search_guild_messages",
    arguments: { guild_id: "123", channel_id: ["100", "999"] },
  });
  expect(errorOf(result)).toMatchObject({
    category: "policy",
    message: "Guild is not allowed",
  });
  expect(makeRequest.mock.calls.some(([url]) => String(url).includes("/messages/search"))).toBe(
    false,
  );
});

it("blocks search when guild_id itself is not allowed", async () => {
  const { client, makeRequest } = await harness({
    policy: new PPolicyEngine(["123"], ["messages"], false),
  });
  const result = await client.callTool({
    name: "discord_search_guild_messages",
    arguments: { guild_id: "456" },
  });
  expect(errorOf(result)).toMatchObject({
    category: "policy",
    message: "Guild is not allowed",
  });
  expect(makeRequest).not.toHaveBeenCalled();
});
