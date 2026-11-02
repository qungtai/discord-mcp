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

const SEARCH_RESPONSE = {
  messages: [[MESSAGE]],
  total_results: 1,
  threads: [],
  members: [],
  doing_deep_historical_index: false,
  documents_indexed: 50,
};

it("searches guild messages with query parameters and parses structured output", async () => {
  const { client, request } = await harness({ respond: () => SEARCH_RESPONSE });
  const result = await client.callTool({
    name: "discord_search_guild_messages",
    arguments: {
      guild_id: "123",
      content: "test",
      sort_by: "timestamp",
      sort_order: "desc",
      author_id: ["10", "20"],
      channel_id: ["100", "200"],
      has: ["link", "file"],
      embed_type: ["image"],
      author_type: ["user", "bot"],
      pinned: true,
      include_nsfw: false,
      mention_everyone: true,
      limit: 10,
      offset: 0,
      slop: 2,
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
  expect(result.structuredContent).toEqual(SEARCH_RESPONSE);
});

it("handles 202 response when search index is not ready", async () => {
  const notReady = {
    message: "Index not ready",
    code: 110000,
    documents_indexed: 12,
    retry_after: 5,
  };
  const { client } = await harness({ respond: () => notReady });
  const result = await client.callTool({
    name: "discord_search_guild_messages",
    arguments: { guild_id: "123" },
  });

  expect(errorOf(result)).toMatchObject({
    category: "rate_limited",
    retryable: true,
    retry_after: 5,
    message: "Search index is not ready",
    remediation: "The search index is still being built; retry after retry_after seconds",
  });
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
  expect(result.structuredContent).toEqual(SEARCH_RESPONSE);
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
