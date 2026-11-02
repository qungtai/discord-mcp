import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { PPolicyEngine } from "../../../src/core/policy.js";
import { errorOf, json } from "../../support/harness.js";
import { SAMPLE_THREAD, setupTestLifecycle, threadHarness } from "./support.js";

beforeEach(setupTestLifecycle);
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it("creates a thread without a message and passes parameters and reason", async () => {
  const { client, request } = await threadHarness({
    respond: () => SAMPLE_THREAD,
  });
  const result = await client.callTool({
    name: "discord_create_thread",
    arguments: {
      channel_id: "1",
      name: "new-thread",
      auto_archive_duration: 60,
      type: 11,
      invitable: true,
      rate_limit_per_user: 10,
      reason: "creating test thread",
    },
  });
  expect(result.structuredContent).toEqual({ thread: SAMPLE_THREAD });
  const req = request();
  expect([req.method, req.url]).toEqual(["POST", "https://discord.com/api/v10/channels/1/threads"]);
  expect(JSON.parse(String(req.body))).toEqual({
    name: "new-thread",
    auto_archive_duration: 60,
    type: 11,
    invitable: true,
    rate_limit_per_user: 10,
  });
  expect(new Headers(req.headers as HeadersInit).get("x-audit-log-reason")).toBe(
    encodeURIComponent("creating test thread"),
  );
});

it("creates a forum thread with initial message and applied_tags", async () => {
  const forumThread = { ...SAMPLE_THREAD, type: 11, applied_tags: ["5001"] };
  const { client, request } = await threadHarness({
    respond: () => forumThread,
  });
  const result = await client.callTool({
    name: "discord_create_thread",
    arguments: {
      channel_id: "1",
      name: "forum-post",
      applied_tags: ["5001"],
      message: {
        content: "hello forum",
      },
    },
  });
  expect(result.structuredContent).toEqual({ thread: forumThread });
  const req = request();
  expect([req.method, req.url]).toEqual(["POST", "https://discord.com/api/v10/channels/1/threads"]);
  expect(JSON.parse(String(req.body))).toEqual({
    name: "forum-post",
    applied_tags: ["5001"],
    message: {
      content: "hello forum",
      allowed_mentions: { parse: [] },
    },
  });
  expect(new Headers(req.headers as HeadersInit).has("x-audit-log-reason")).toBe(false);
});

it("rejects invalid auto_archive_duration", async () => {
  const { client, makeRequest } = await threadHarness();
  const result = await client.callTool({
    name: "discord_create_thread",
    arguments: { channel_id: "1", name: "bad", auto_archive_duration: 123 },
  });
  expect(errorOf(result)).toMatchObject({ category: "validation" });
  expect(makeRequest).not.toHaveBeenCalled();
});

it("handles 403 missing permissions error with literal category and message", async () => {
  const { client } = await threadHarness({
    makeRequest: async () => json({ message: "Missing Permissions", code: 50013 }, { status: 403 }),
  });
  const result = await client.callTool({
    name: "discord_create_thread",
    arguments: { channel_id: "1", name: "forbidden" },
  });
  expect(errorOf(result)).toMatchObject({
    category: "permission",
    status: 403,
    discord_code: 50013,
    message: "Discord rejected the request (HTTP 403): Missing Permissions",
  });
});

it("handles 404 not found error with literal category and message", async () => {
  const { client } = await threadHarness({
    makeRequest: async () => json({ message: "Unknown Channel", code: 10003 }, { status: 404 }),
  });
  const result = await client.callTool({
    name: "discord_create_thread",
    arguments: { channel_id: "999", name: "unknown" },
  });
  expect(errorOf(result)).toMatchObject({
    category: "not_found",
    status: 404,
    discord_code: 10003,
    message: "Discord rejected the request (HTTP 404): Unknown Channel",
  });
});

it("succeeds under an allowlist containing the guild with literal routes and body", async () => {
  const { client, request } = await threadHarness({
    policy: new PPolicyEngine(["200"], ["threads"], false),
    makeRequest: async (url) => {
      if (String(url).endsWith("/channels/1")) {
        return json({ id: "1", guild_id: "200" });
      }
      return json(SAMPLE_THREAD);
    },
  });
  const result = await client.callTool({
    name: "discord_create_thread",
    arguments: { channel_id: "1", name: "allowed" },
  });
  expect(result.structuredContent).toEqual({ thread: SAMPLE_THREAD });
  expect([request(0).method, request(0).url]).toEqual([
    "GET",
    "https://discord.com/api/v10/channels/1",
  ]);
  expect([request(1).method, request(1).url]).toEqual([
    "POST",
    "https://discord.com/api/v10/channels/1/threads",
  ]);
  expect(JSON.parse(String(request(1).body))).toEqual({ name: "allowed" });
});

it("denies channel in a guild outside the allowlist before sending write", async () => {
  const { client, request, makeRequest } = await threadHarness({
    policy: new PPolicyEngine(["200"], ["threads"], false),
    makeRequest: async () => json({ id: "1", guild_id: "300" }),
  });
  const result = await client.callTool({
    name: "discord_create_thread",
    arguments: { channel_id: "1", name: "denied" },
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
