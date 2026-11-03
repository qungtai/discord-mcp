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
  threads: [
    {
      ...SAMPLE_THREAD,
      id: "9001",
      type: 12,
      thread_metadata: { ...SAMPLE_THREAD.thread_metadata, archived: true },
    },
  ],
  members: [],
  has_more: true,
};

it("lists my private archived threads and computes next_before cursor when has_more is true", async () => {
  const { client, request } = await threadHarness({
    respond: () => THREAD_LIST,
  });
  const result = await client.callTool({
    name: "discord_list_my_private_archived_threads",
    arguments: {
      channel_id: "1",
      before: "99999",
      limit: 15,
    },
  });
  expect(result.structuredContent).toEqual({
    ...THREAD_LIST,
    next_before: "9001",
  });
  const req = request();
  expect([req.method, req.url]).toEqual([
    "GET",
    "https://discord.com/api/v10/channels/1/users/@me/threads/archived/private?before=99999&limit=15",
  ]);
});

it("returns null next_before when has_more is false", async () => {
  const { client } = await threadHarness({
    respond: () => ({ threads: [SAMPLE_THREAD], members: [], has_more: false }),
  });
  const result = await client.callTool({
    name: "discord_list_my_private_archived_threads",
    arguments: { channel_id: "1" },
  });
  expect(result.structuredContent).toEqual({
    threads: [SAMPLE_THREAD],
    members: [],
    has_more: false,
    next_before: null,
  });
});

it("validates channel_id format", async () => {
  const { client, makeRequest } = await threadHarness();
  const result = await client.callTool({
    name: "discord_list_my_private_archived_threads",
    arguments: { channel_id: "invalid" },
  });
  expect(errorOf(result)).toMatchObject({ category: "validation" });
  expect(makeRequest).not.toHaveBeenCalled();
});

it("handles 403 error with literal message", async () => {
  const { client } = await threadHarness({
    makeRequest: async () => json({ message: "Missing Access", code: 50001 }, { status: 403 }),
  });
  const result = await client.callTool({
    name: "discord_list_my_private_archived_threads",
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
    name: "discord_list_my_private_archived_threads",
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
      return json(THREAD_LIST);
    },
  });
  const result = await client.callTool({
    name: "discord_list_my_private_archived_threads",
    arguments: { channel_id: "1" },
  });
  expect(result.structuredContent).toEqual({
    ...THREAD_LIST,
    next_before: "9001",
  });
  expect([request(0).method, request(0).url]).toEqual([
    "GET",
    "https://discord.com/api/v10/channels/1",
  ]);
  expect([request(1).method, request(1).url]).toEqual([
    "GET",
    "https://discord.com/api/v10/channels/1/users/@me/threads/archived/private",
  ]);
});

it("denies channel in a guild outside the allowlist", async () => {
  const { client, request, makeRequest } = await threadHarness({
    policy: new PPolicyEngine(["200"], ["threads"], false),
    makeRequest: async () => json({ id: "1", guild_id: "300" }),
  });
  const result = await client.callTool({
    name: "discord_list_my_private_archived_threads",
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
