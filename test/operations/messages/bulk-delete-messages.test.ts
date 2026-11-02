import type { ResponseLike } from "@discordjs/rest";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { PPolicyEngine } from "../../../src/core/policy.js";
import { PToolRegistry } from "../../../src/core/tool-registry.js";
import { errorOf, harness, json } from "../../support/harness.js";

beforeEach(() => {
  vi.spyOn(process.stderr, "write").mockReturnValue(true);
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const args = { channel_id: "1", message_ids: ["10", "11"], reason: "cleanup batch" };
const empty204 = () => new Response(null, { status: 204 }) as unknown as ResponseLike;

async function toolHarness(options: Parameters<typeof harness>[0] = {}) {
  const base = (await PToolRegistry.load()).get("discord_bulk_delete_messages");
  if (!base) throw new Error("Missing tool");
  const registry = new PToolRegistry();
  registry.register(base);
  return harness({ ...options, registry });
}

it("bulk deletes messages with an audit reason after the client accepts approval", async () => {
  const { client, request } = await toolHarness({
    makeRequest: async () => empty204(),
  });
  const result = await client.callTool({
    name: "discord_bulk_delete_messages",
    arguments: args,
  });
  const { url, method, body, headers } = request();
  expect([method, url]).toEqual([
    "POST",
    "https://discord.com/api/v10/channels/1/messages/bulk-delete",
  ]);
  expect(new Headers(headers as HeadersInit).get("x-audit-log-reason")).toBe("cleanup%20batch");
  expect(JSON.parse(String(body))).toEqual({ messages: ["10", "11"] });
  expect(result.structuredContent).toEqual({
    deleted: true,
    channel_id: "1",
    message_ids: ["10", "11"],
  });
});

it("allows access under an allowed guild", async () => {
  const { client } = await toolHarness({
    policy: new PPolicyEngine(["100"], ["core", "messages"], false),
    makeRequest: async (url) => {
      if (String(url).endsWith("/channels/1")) return json({ id: "1", guild_id: "100" });
      return empty204();
    },
  });
  const result = await client.callTool({
    name: "discord_bulk_delete_messages",
    arguments: { channel_id: "1", message_ids: ["10", "11"] },
  });
  expect(result.structuredContent).toEqual({
    deleted: true,
    channel_id: "1",
    message_ids: ["10", "11"],
  });
});

it("blocks access when channel belongs to a disallowed guild", async () => {
  const { client, makeRequest } = await toolHarness({
    policy: new PPolicyEngine(["100"], ["core", "messages"], false),
    respond: () => ({ id: "1", guild_id: "200" }),
  });
  const result = await client.callTool({
    name: "discord_bulk_delete_messages",
    arguments: { channel_id: "1", message_ids: ["10", "11"] },
  });
  expect(errorOf(result)).toMatchObject({ category: "policy", message: "Guild is not allowed" });
  expect(makeRequest).toHaveBeenCalledTimes(1);
});

it("fails validation if fewer than 2, duplicate, or more than 100 messages are provided", async () => {
  const { client, makeRequest } = await toolHarness();

  const fewer = await client.callTool({
    name: "discord_bulk_delete_messages",
    arguments: { channel_id: "1", message_ids: ["10"] },
  });
  expect(errorOf(fewer)).toMatchObject({
    category: "validation",
    message: "Invalid input: message_ids: Bulk delete requires at least 2 messages",
  });

  const dupes = await client.callTool({
    name: "discord_bulk_delete_messages",
    arguments: { channel_id: "1", message_ids: ["10", "10"] },
  });
  expect(errorOf(dupes)).toMatchObject({
    category: "validation",
    message: "Invalid input: message_ids: Message IDs must be unique",
  });

  const over100 = Array.from({ length: 101 }, (_, i) => String(i + 1));
  const tooMany = await client.callTool({
    name: "discord_bulk_delete_messages",
    arguments: { channel_id: "1", message_ids: over100 },
  });
  expect(errorOf(tooMany)).toMatchObject({
    category: "validation",
    message: "Invalid input: message_ids: Bulk delete cannot exceed 100 messages",
  });

  expect(makeRequest).not.toHaveBeenCalled();
});

it("maps a 403 to permission error", async () => {
  const { client } = await toolHarness({
    makeRequest: async () => json({ message: "Missing Permissions", code: 50013 }, { status: 403 }),
  });
  const result = await client.callTool({
    name: "discord_bulk_delete_messages",
    arguments: { channel_id: "1", message_ids: ["10", "11"] },
  });
  expect(errorOf(result)).toEqual({
    category: "permission",
    retryable: false,
    status: 403,
    discord_code: 50013,
    message: "Discord rejected the request (HTTP 403): Missing Permissions",
    remediation: "Check the bot permissions; this tool needs ViewChannel, ManageMessages",
    tool: "discord_bulk_delete_messages",
    correlation_id: expect.any(String),
    resource_ids: { channel_id: "1", message_ids: "10,11" },
  });
});

it("maps a 404 to not_found error", async () => {
  const { client } = await toolHarness({
    makeRequest: async () => json({ message: "Unknown Channel", code: 10003 }, { status: 404 }),
  });
  const result = await client.callTool({
    name: "discord_bulk_delete_messages",
    arguments: { channel_id: "1", message_ids: ["10", "11"] },
  });
  expect(errorOf(result)).toEqual({
    category: "not_found",
    retryable: false,
    status: 404,
    discord_code: 10003,
    message: "Discord rejected the request (HTTP 404): Unknown Channel",
    remediation: "Check the IDs in the request",
    tool: "discord_bulk_delete_messages",
    correlation_id: expect.any(String),
    resource_ids: { channel_id: "1", message_ids: "10,11" },
  });
});
