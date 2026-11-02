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

const THREAD = {
  id: "102",
  type: 11,
  guild_id: "200",
  name: "msg-thread",
  parent_id: "1",
};

const threadHarness = (options: Parameters<typeof harness>[0] = {}) =>
  harness({
    ...options,
    policy: options.policy ?? new PPolicyEngine([], ["threads"], false),
  });

it("creates a thread from a message and passes parameters and reason", async () => {
  const { client, request } = await threadHarness({
    respond: () => THREAD,
  });
  const result = await client.callTool({
    name: "discord_create_thread_from_message",
    arguments: {
      channel_id: "1",
      message_id: "555",
      name: "msg-thread",
      auto_archive_duration: 1440,
      rate_limit_per_user: 5,
      reason: "thread from message",
    },
  });
  expect(result.structuredContent).toEqual({ thread: THREAD });
  const req = request();
  expect([req.method, req.url]).toEqual([
    "POST",
    "https://discord.com/api/v10/channels/1/messages/555/threads",
  ]);
  expect(JSON.parse(String(req.body))).toEqual({
    name: "msg-thread",
    auto_archive_duration: 1440,
    rate_limit_per_user: 5,
  });
  expect(new Headers(req.headers as HeadersInit).get("x-audit-log-reason")).toBe(
    encodeURIComponent("thread from message"),
  );
});

it("validates channel_id and message_id format", async () => {
  const { client, makeRequest } = await threadHarness();
  const result = await client.callTool({
    name: "discord_create_thread_from_message",
    arguments: { channel_id: "invalid", message_id: "555", name: "bad" },
  });
  expect(errorOf(result)).toMatchObject({ category: "validation" });
  expect(makeRequest).not.toHaveBeenCalled();
});

it("handles 403 missing permissions error", async () => {
  const { client } = await threadHarness({
    makeRequest: async () => json({ message: "Missing Permissions", code: 50013 }, { status: 403 }),
  });
  const result = await client.callTool({
    name: "discord_create_thread_from_message",
    arguments: { channel_id: "1", message_id: "555", name: "forbidden" },
  });
  expect(errorOf(result)).toMatchObject({
    category: "permission",
    status: 403,
    discord_code: 50013,
  });
});

it("handles 404 not found error", async () => {
  const { client } = await threadHarness({
    makeRequest: async () => json({ message: "Unknown Message", code: 10008 }, { status: 404 }),
  });
  const result = await client.callTool({
    name: "discord_create_thread_from_message",
    arguments: { channel_id: "1", message_id: "999", name: "not found" },
  });
  expect(errorOf(result)).toMatchObject({
    category: "not_found",
    status: 404,
  });
});

it("succeeds under an allowlist containing the guild", async () => {
  const { client, request } = await threadHarness({
    policy: new PPolicyEngine(["200"], ["threads"], false),
    makeRequest: async (url) => {
      if (String(url).endsWith("/channels/1")) {
        return json({ id: "1", guild_id: "200" });
      }
      return json(THREAD);
    },
  });
  const result = await client.callTool({
    name: "discord_create_thread_from_message",
    arguments: { channel_id: "1", message_id: "555", name: "allowed" },
  });
  expect(result.structuredContent).toEqual({ thread: THREAD });
  expect(request(1).method).toBe("POST");
});

it("denies channel in a guild outside the allowlist before sending write", async () => {
  const { client, makeRequest } = await threadHarness({
    policy: new PPolicyEngine(["200"], ["threads"], false),
    makeRequest: async () => json({ id: "1", guild_id: "300" }),
  });
  const result = await client.callTool({
    name: "discord_create_thread_from_message",
    arguments: { channel_id: "1", message_id: "555", name: "denied" },
  });
  expect(errorOf(result)).toMatchObject({
    category: "policy",
    message: "Guild is not allowed",
  });
  expect(makeRequest).toHaveBeenCalledTimes(1);
});
