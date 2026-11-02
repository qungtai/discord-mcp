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

const args = { channel_id: "1", message_id: "2", reason: "cleanup message" };
const empty204 = () => new Response(null, { status: 204 }) as unknown as ResponseLike;

async function toolHarness(options: Parameters<typeof harness>[0] = {}) {
  const base = (await PToolRegistry.load()).get("discord_delete_message");
  if (!base) throw new Error("Missing tool");
  const registry = new PToolRegistry();
  registry.register(base);
  return harness({ ...options, registry });
}

it("deletes a message with an audit reason after the client accepts approval", async () => {
  const { client, request } = await toolHarness({
    makeRequest: async () => empty204(),
  });
  const result = await client.callTool({
    name: "discord_delete_message",
    arguments: args,
  });
  const { url, method, headers } = request();
  expect([method, url]).toEqual(["DELETE", "https://discord.com/api/v10/channels/1/messages/2"]);
  expect(new Headers(headers as HeadersInit).get("x-audit-log-reason")).toBe("cleanup%20message");
  expect(result.structuredContent).toEqual({
    deleted: true,
    channel_id: "1",
    message_id: "2",
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
    name: "discord_delete_message",
    arguments: { channel_id: "1", message_id: "2" },
  });
  expect(result.structuredContent).toEqual({
    deleted: true,
    channel_id: "1",
    message_id: "2",
  });
});

it("blocks access when channel belongs to a disallowed guild", async () => {
  const { client, makeRequest } = await toolHarness({
    policy: new PPolicyEngine(["100"], ["core", "messages"], false),
    respond: () => ({ id: "1", guild_id: "200" }),
  });
  const result = await client.callTool({
    name: "discord_delete_message",
    arguments: { channel_id: "1", message_id: "2" },
  });
  expect(errorOf(result)).toMatchObject({ category: "policy", message: "Guild is not allowed" });
  expect(makeRequest).toHaveBeenCalledTimes(1);
});

it("blocks mutating call in read-only mode", async () => {
  const { client, makeRequest } = await toolHarness({
    policy: new PPolicyEngine([], ["messages"], true),
  });
  const result = await client.callTool({
    name: "discord_delete_message",
    arguments: { channel_id: "1", message_id: "2" },
  });
  expect(errorOf(result)).toMatchObject({ category: "policy", message: "Read-only mode" });
  expect(makeRequest).not.toHaveBeenCalled();
});

it("maps a 403 to permission error", async () => {
  const { client } = await toolHarness({
    makeRequest: async () => json({ message: "Missing Permissions", code: 50013 }, { status: 403 }),
  });
  const result = await client.callTool({
    name: "discord_delete_message",
    arguments: { channel_id: "1", message_id: "2" },
  });
  expect(errorOf(result)).toEqual({
    category: "permission",
    retryable: false,
    status: 403,
    discord_code: 50013,
    message: "Discord rejected the request (HTTP 403): Missing Permissions",
    remediation: "Check the bot permissions; this tool needs ViewChannel, ManageMessages",
    tool: "discord_delete_message",
    correlation_id: expect.any(String),
    resource_ids: { channel_id: "1", message_id: "2" },
  });
});

it("maps a 404 to not_found error", async () => {
  const { client } = await toolHarness({
    makeRequest: async () => json({ message: "Unknown Message", code: 10008 }, { status: 404 }),
  });
  const result = await client.callTool({
    name: "discord_delete_message",
    arguments: { channel_id: "1", message_id: "2" },
  });
  expect(errorOf(result)).toEqual({
    category: "not_found",
    retryable: false,
    status: 404,
    discord_code: 10008,
    message: "Discord rejected the request (HTTP 404): Unknown Message",
    remediation: "Check the IDs in the request",
    tool: "discord_delete_message",
    correlation_id: expect.any(String),
    resource_ids: { channel_id: "1", message_id: "2" },
  });
});
