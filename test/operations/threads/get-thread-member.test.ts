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

const MEMBER = {
  id: "101",
  user_id: "501",
  join_timestamp: "2026-11-03T00:00:00.000Z",
  flags: 0,
};

const threadHarness = (options: Parameters<typeof harness>[0] = {}) =>
  harness({
    ...options,
    policy: options.policy ?? new PPolicyEngine([], ["threads"], false),
  });

it("gets a thread member with query options", async () => {
  const { client, request } = await threadHarness({
    respond: () => MEMBER,
  });
  const result = await client.callTool({
    name: "discord_get_thread_member",
    arguments: {
      channel_id: "101",
      user_id: "501",
      with_member: true,
    },
  });
  expect(result.structuredContent).toEqual({ member: MEMBER });
  const req = request();
  expect([req.method, req.url]).toEqual([
    "GET",
    "https://discord.com/api/v10/channels/101/thread-members/501?with_member=true",
  ]);
});

it("validates user_id format", async () => {
  const { client, makeRequest } = await threadHarness();
  const result = await client.callTool({
    name: "discord_get_thread_member",
    arguments: { channel_id: "101", user_id: "invalid" },
  });
  expect(errorOf(result)).toMatchObject({ category: "validation" });
  expect(makeRequest).not.toHaveBeenCalled();
});

it("handles 403 error", async () => {
  const { client } = await threadHarness({
    makeRequest: async () => json({ message: "Missing Access", code: 50001 }, { status: 403 }),
  });
  const result = await client.callTool({
    name: "discord_get_thread_member",
    arguments: { channel_id: "101", user_id: "501" },
  });
  expect(errorOf(result)).toMatchObject({ category: "permission", status: 403 });
});

it("handles 404 error", async () => {
  const { client } = await threadHarness({
    makeRequest: async () => json({ message: "Unknown Member", code: 10007 }, { status: 404 }),
  });
  const result = await client.callTool({
    name: "discord_get_thread_member",
    arguments: { channel_id: "101", user_id: "999" },
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
      return json(MEMBER);
    },
  });
  const result = await client.callTool({
    name: "discord_get_thread_member",
    arguments: { channel_id: "101", user_id: "501" },
  });
  expect(result.structuredContent).toEqual({ member: MEMBER });
  expect(request(1).method).toBe("GET");
});

it("denies channel in a guild outside the allowlist", async () => {
  const { client, makeRequest } = await threadHarness({
    policy: new PPolicyEngine(["200"], ["threads"], false),
    makeRequest: async () => json({ id: "101", guild_id: "300" }),
  });
  const result = await client.callTool({
    name: "discord_get_thread_member",
    arguments: { channel_id: "101", user_id: "501" },
  });
  expect(errorOf(result)).toMatchObject({
    category: "policy",
    message: "Guild is not allowed",
  });
  expect(makeRequest).toHaveBeenCalledTimes(1);
});
