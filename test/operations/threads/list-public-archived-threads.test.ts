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
  threads: [{ id: "101", name: "archived-public", type: 11, guild_id: "200" }],
  members: [],
  has_more: false,
};

const threadHarness = (options: Parameters<typeof harness>[0] = {}) =>
  harness({
    ...options,
    policy: options.policy ?? new PPolicyEngine([], ["threads"], false),
  });

it("lists public archived threads with before and limit query params", async () => {
  const { client, request } = await threadHarness({
    respond: () => THREAD_LIST,
  });
  const result = await client.callTool({
    name: "discord_list_public_archived_threads",
    arguments: {
      channel_id: "1",
      before: "2026-11-03T00:00:00.000Z",
      limit: 10,
    },
  });
  expect(result.structuredContent).toEqual(THREAD_LIST);
  const req = request();
  expect([req.method, req.url]).toEqual([
    "GET",
    "https://discord.com/api/v10/channels/1/threads/archived/public?before=2026-11-03T00%3A00%3A00.000Z&limit=10",
  ]);
});

it("validates limit range (min 2, max 100)", async () => {
  const { client, makeRequest } = await threadHarness();
  const result = await client.callTool({
    name: "discord_list_public_archived_threads",
    arguments: { channel_id: "1", limit: 1 },
  });
  expect(errorOf(result)).toMatchObject({ category: "validation" });
  expect(makeRequest).not.toHaveBeenCalled();
});

it("handles 403 error", async () => {
  const { client } = await threadHarness({
    makeRequest: async () => json({ message: "Missing Access", code: 50001 }, { status: 403 }),
  });
  const result = await client.callTool({
    name: "discord_list_public_archived_threads",
    arguments: { channel_id: "1" },
  });
  expect(errorOf(result)).toMatchObject({ category: "permission", status: 403 });
});

it("handles 404 error", async () => {
  const { client } = await threadHarness({
    makeRequest: async () => json({ message: "Unknown Channel", code: 10003 }, { status: 404 }),
  });
  const result = await client.callTool({
    name: "discord_list_public_archived_threads",
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
      return json(THREAD_LIST);
    },
  });
  const result = await client.callTool({
    name: "discord_list_public_archived_threads",
    arguments: { channel_id: "1" },
  });
  expect(result.structuredContent).toEqual(THREAD_LIST);
  expect(request(1).method).toBe("GET");
});

it("denies channel in a guild outside the allowlist", async () => {
  const { client, makeRequest } = await threadHarness({
    policy: new PPolicyEngine(["200"], ["threads"], false),
    makeRequest: async () => json({ id: "1", guild_id: "300" }),
  });
  const result = await client.callTool({
    name: "discord_list_public_archived_threads",
    arguments: { channel_id: "1" },
  });
  expect(errorOf(result)).toMatchObject({
    category: "policy",
    message: "Guild is not allowed",
  });
  expect(makeRequest).toHaveBeenCalledTimes(1);
});
