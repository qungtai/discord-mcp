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

const empty204 = () => new Response(null, { status: 204 }) as unknown as ResponseLike;

it("triggers typing indicator in a channel", async () => {
  const { client, request } = await harness({
    makeRequest: async () => empty204(),
  });
  const result = await client.callTool({
    name: "discord_trigger_typing_indicator",
    arguments: { channel_id: "1" },
  });
  const { url, method } = request();
  expect([method, url]).toEqual(["POST", "https://discord.com/api/v10/channels/1/typing"]);
  expect(result.structuredContent).toEqual({
    triggered: true,
    channel_id: "1",
  });
});

it("allows access under an allowed guild", async () => {
  const { client } = await harness({
    policy: new PPolicyEngine(["100"], ["core", "messages"], false),
    makeRequest: async (url) => {
      if (String(url).endsWith("/channels/1")) return json({ id: "1", guild_id: "100" });
      return empty204();
    },
  });
  const result = await client.callTool({
    name: "discord_trigger_typing_indicator",
    arguments: { channel_id: "1" },
  });
  expect(result.structuredContent).toEqual({
    triggered: true,
    channel_id: "1",
  });
});

it("blocks access when channel belongs to a disallowed guild", async () => {
  const { client, makeRequest } = await harness({
    policy: new PPolicyEngine(["100"], ["core", "messages"], false),
    respond: () => ({ id: "1", guild_id: "200" }),
  });
  const result = await client.callTool({
    name: "discord_trigger_typing_indicator",
    arguments: { channel_id: "1" },
  });
  expect(errorOf(result)).toMatchObject({ category: "policy", message: "Guild is not allowed" });
  expect(makeRequest).toHaveBeenCalledTimes(1);
});

it("maps a 403 to permission error", async () => {
  const { client } = await harness({
    makeRequest: async () => json({ message: "Missing Permissions", code: 50013 }, { status: 403 }),
  });
  const result = await client.callTool({
    name: "discord_trigger_typing_indicator",
    arguments: { channel_id: "1" },
  });
  expect(errorOf(result)).toEqual({
    category: "permission",
    retryable: false,
    status: 403,
    discord_code: 50013,
    message: "Discord rejected the request (HTTP 403): Missing Permissions",
    remediation: "Check the bot permissions; this tool needs ViewChannel, SendMessages",
    tool: "discord_trigger_typing_indicator",
    correlation_id: expect.any(String),
    resource_ids: { channel_id: "1" },
  });
});

it("maps a 404 to not_found error", async () => {
  const { client } = await harness({
    makeRequest: async () => json({ message: "Unknown Channel", code: 10003 }, { status: 404 }),
  });
  const result = await client.callTool({
    name: "discord_trigger_typing_indicator",
    arguments: { channel_id: "1" },
  });
  expect(errorOf(result)).toEqual({
    category: "not_found",
    retryable: false,
    status: 404,
    discord_code: 10003,
    message: "Discord rejected the request (HTTP 404): Unknown Channel",
    remediation: "Check the IDs in the request",
    tool: "discord_trigger_typing_indicator",
    correlation_id: expect.any(String),
    resource_ids: { channel_id: "1" },
  });
});
