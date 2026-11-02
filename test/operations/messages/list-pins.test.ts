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

const pinned = { pinned_at: "2026-11-03T00:00:00.000Z", message: MESSAGE };

it("lists pinned messages in a channel with query parameters", async () => {
  const { client, request } = await harness({
    respond: () => ({ items: [pinned], has_more: true }),
  });
  const result = await client.callTool({
    name: "discord_list_pins",
    arguments: { channel_id: "1", limit: 10, before: "2026-11-03T00:00:00.000Z" },
  });
  const { url, method } = request();
  expect([method, url]).toEqual([
    "GET",
    "https://discord.com/api/v10/channels/1/messages/pins?before=2026-11-03T00%3A00%3A00.000Z&limit=10",
  ]);
  expect(result.structuredContent).toEqual({
    items: [pinned],
    has_more: true,
    next_before: "2026-11-03T00:00:00.000Z",
  });
});

it("returns next_before as null when has_more is false", async () => {
  const { client } = await harness({
    respond: () => ({ items: [pinned], has_more: false }),
  });
  const result = await client.callTool({
    name: "discord_list_pins",
    arguments: { channel_id: "1" },
  });
  expect(result.structuredContent).toEqual({
    items: [pinned],
    has_more: false,
    next_before: null,
  });
});

it("allows access under an allowed guild", async () => {
  const { client } = await harness({
    policy: new PPolicyEngine(["100"], ["core", "messages"], false),
    makeRequest: async (url) => {
      if (String(url).endsWith("/channels/1")) return json({ id: "1", guild_id: "100" });
      return json({ items: [pinned], has_more: false });
    },
  });
  const result = await client.callTool({
    name: "discord_list_pins",
    arguments: { channel_id: "1" },
  });
  expect(result.structuredContent).toEqual({
    items: [pinned],
    has_more: false,
    next_before: null,
  });
});

it("blocks access when channel belongs to a disallowed guild", async () => {
  const { client, makeRequest } = await harness({
    policy: new PPolicyEngine(["100"], ["core", "messages"], false),
    respond: () => ({ id: "1", guild_id: "200" }),
  });
  const result = await client.callTool({
    name: "discord_list_pins",
    arguments: { channel_id: "1" },
  });
  expect(errorOf(result)).toMatchObject({ category: "policy", message: "Guild is not allowed" });
  expect(makeRequest).toHaveBeenCalledTimes(1);
});

it("fails input validation on invalid snowflake or out of bounds limit", async () => {
  const { client, makeRequest } = await harness();
  const invalidSnowflake = await client.callTool({
    name: "discord_list_pins",
    arguments: { channel_id: "invalid" },
  });
  expect(errorOf(invalidSnowflake)).toMatchObject({ category: "validation" });

  const invalidLimit = await client.callTool({
    name: "discord_list_pins",
    arguments: { channel_id: "1", limit: 51 },
  });
  expect(errorOf(invalidLimit)).toMatchObject({ category: "validation" });
  expect(makeRequest).not.toHaveBeenCalled();
});

it("maps a 403 to permission error", async () => {
  const { client } = await harness({
    makeRequest: async () => json({ message: "Missing Permissions", code: 50013 }, { status: 403 }),
  });
  const result = await client.callTool({
    name: "discord_list_pins",
    arguments: { channel_id: "1" },
  });
  expect(errorOf(result)).toEqual({
    category: "permission",
    retryable: false,
    status: 403,
    discord_code: 50013,
    message: "Discord rejected the request (HTTP 403): Missing Permissions",
    remediation: "Check the bot permissions; this tool needs ViewChannel, ReadMessageHistory",
    tool: "discord_list_pins",
    correlation_id: expect.any(String),
    resource_ids: { channel_id: "1" },
  });
});

it("maps a 404 to not_found error", async () => {
  const { client } = await harness({
    makeRequest: async () => json({ message: "Unknown Channel", code: 10003 }, { status: 404 }),
  });
  const result = await client.callTool({
    name: "discord_list_pins",
    arguments: { channel_id: "1" },
  });
  expect(errorOf(result)).toEqual({
    category: "not_found",
    retryable: false,
    status: 404,
    discord_code: 10003,
    message: "Discord rejected the request (HTTP 404): Unknown Channel",
    remediation: "Check the IDs in the request",
    tool: "discord_list_pins",
    correlation_id: expect.any(String),
    resource_ids: { channel_id: "1" },
  });
});
