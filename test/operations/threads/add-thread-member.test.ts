import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { PPolicyEngine } from "../../../src/core/policy.js";
import { errorOf, json } from "../../support/harness.js";
import { empty204, setupTestLifecycle, threadHarness } from "./support.js";

beforeEach(setupTestLifecycle);
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it("adds a thread member and returns added status", async () => {
  const { client, request } = await threadHarness({
    makeRequest: async () => empty204(),
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

it("handles 403 error with literal message", async () => {
  const { client } = await threadHarness({
    makeRequest: async () => json({ message: "Missing Access", code: 50001 }, { status: 403 }),
  });
  const result = await client.callTool({
    name: "discord_add_thread_member",
    arguments: { channel_id: "101", user_id: "501" },
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
    name: "discord_add_thread_member",
    arguments: { channel_id: "999", user_id: "501" },
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
      if (String(url).endsWith("/channels/101")) {
        return json({ id: "101", guild_id: "200" });
      }
      return empty204();
    },
  });
  const result = await client.callTool({
    name: "discord_add_thread_member",
    arguments: { channel_id: "101", user_id: "501" },
  });
  expect(result.structuredContent).toEqual({ added: true, channel_id: "101", user_id: "501" });
  expect([request(0).method, request(0).url]).toEqual([
    "GET",
    "https://discord.com/api/v10/channels/101",
  ]);
  expect([request(1).method, request(1).url]).toEqual([
    "PUT",
    "https://discord.com/api/v10/channels/101/thread-members/501",
  ]);
});

it("denies channel in a guild outside the allowlist before sending write", async () => {
  const { client, request, makeRequest } = await threadHarness({
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
  expect([request(0).method, request(0).url]).toEqual([
    "GET",
    "https://discord.com/api/v10/channels/101",
  ]);
});
