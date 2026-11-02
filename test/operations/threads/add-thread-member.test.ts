import type { ResponseLike } from "@discordjs/rest";
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

const threadHarness = (options: Parameters<typeof harness>[0] = {}) =>
  harness({
    ...options,
    policy: options.policy ?? new PPolicyEngine([], ["threads"], false),
  });

it("adds a thread member and returns added status", async () => {
  const { client, request } = await threadHarness({
    makeRequest: async () => new Response(null, { status: 204 }) as unknown as ResponseLike,
  });
  const result = await client.callTool({
    name: "discord_add_thread_member",
    arguments: { channel_id: "101", user_id: "501" },
  });
  expect(result.structuredContent).toEqual({ added: true, channel_id: "101", user_id: "501" });
  const req = request();
  expect([req.method, req.url]).toEqual([
    "PUT",
    "https://discord.com/api/v10/channels/101/thread-members/501",
  ]);
});

it("validates channel_id and user_id format", async () => {
  const { client, makeRequest } = await threadHarness();
  const result = await client.callTool({
    name: "discord_add_thread_member",
    arguments: { channel_id: "not-snowflake", user_id: "501" },
  });
  expect(errorOf(result)).toMatchObject({ category: "validation" });
  expect(makeRequest).not.toHaveBeenCalled();
});

it("handles 403 error", async () => {
  const { client } = await threadHarness({
    makeRequest: async () => json({ message: "Missing Access", code: 50001 }, { status: 403 }),
  });
  const result = await client.callTool({
    name: "discord_add_thread_member",
    arguments: { channel_id: "101", user_id: "501" },
  });
  expect(errorOf(result)).toMatchObject({ category: "permission", status: 403 });
});

it("handles 404 error", async () => {
  const { client } = await threadHarness({
    makeRequest: async () => json({ message: "Unknown Channel", code: 10003 }, { status: 404 }),
  });
  const result = await client.callTool({
    name: "discord_add_thread_member",
    arguments: { channel_id: "999", user_id: "501" },
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
      return new Response(null, { status: 204 }) as unknown as ResponseLike;
    },
  });
  const result = await client.callTool({
    name: "discord_add_thread_member",
    arguments: { channel_id: "101", user_id: "501" },
  });
  expect(result.structuredContent).toEqual({ added: true, channel_id: "101", user_id: "501" });
  expect(request(1).method).toBe("PUT");
});

it("denies channel in a guild outside the allowlist before sending write", async () => {
  const { client, makeRequest } = await threadHarness({
    policy: new PPolicyEngine(["200"], ["threads"], false),
    makeRequest: async () => json({ id: "101", guild_id: "300" }),
  });
  const result = await client.callTool({
    name: "discord_add_thread_member",
    arguments: { channel_id: "101", user_id: "501" },
  });
  expect(errorOf(result)).toMatchObject({
    category: "policy",
    message: "Guild is not allowed",
  });
  expect(makeRequest).toHaveBeenCalledTimes(1);
});
