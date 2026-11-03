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

const channelId = "100";
const messageId = "200";

it("expires a poll immediately without approval and returns the message", async () => {
  const { client, request } = await harness({
    policy: new PPolicyEngine([], ["messages"], false),
    respond: () => MESSAGE,
  });
  const result = await client.callTool({
    name: "discord_end_poll",
    arguments: { channel_id: channelId, message_id: messageId },
  });
  const req = request();
  expect([req.method, req.url]).toEqual([
    "POST",
    "https://discord.com/api/v10/channels/100/polls/200/expire",
  ]);
  expect(result.structuredContent).toEqual({ message: MESSAGE });
});

it.each([
  ["invalid channel_id", { channel_id: "not-a-snowflake", message_id: messageId }],
  ["invalid message_id", { channel_id: channelId, message_id: "not-a-snowflake" }],
  ["unknown extra property", { channel_id: channelId, message_id: messageId, extra: 1 }],
])("validates input strictly: %s", async (_, args) => {
  const { client, makeRequest } = await harness({
    policy: new PPolicyEngine([], ["messages"], false),
  });
  const result = await client.callTool({
    name: "discord_end_poll",
    arguments: args,
  });
  expect(errorOf(result)).toMatchObject({ category: "validation" });
  expect(makeRequest).not.toHaveBeenCalled();
});

it("maps 403 to permission error with ViewChannel", async () => {
  const { client } = await harness({
    policy: new PPolicyEngine([], ["messages"], false),
    makeRequest: async () => json({ message: "Missing Permissions", code: 50013 }, { status: 403 }),
  });
  const result = await client.callTool({
    name: "discord_end_poll",
    arguments: { channel_id: channelId, message_id: messageId },
  });
  expect(errorOf(result)).toMatchObject({
    category: "permission",
    status: 403,
    discord_code: 50013,
    remediation: "Check the bot permissions; this tool needs ViewChannel",
  });
});

it("maps 404 to not_found", async () => {
  const { client } = await harness({
    policy: new PPolicyEngine([], ["messages"], false),
    makeRequest: async () => json({ message: "Unknown Message", code: 10008 }, { status: 404 }),
  });
  const result = await client.callTool({
    name: "discord_end_poll",
    arguments: { channel_id: channelId, message_id: messageId },
  });
  expect(errorOf(result)).toMatchObject({
    category: "not_found",
    status: 404,
  });
});

it("allows access under an allowed guild and denies under disallowed guild", async () => {
  const allowed = await harness({
    policy: new PPolicyEngine(["500"], ["messages"], false),
    makeRequest: async (url) => {
      if (String(url).endsWith(`/channels/${channelId}`)) {
        return json({ id: channelId, guild_id: "500" });
      }
      return json(MESSAGE);
    },
  });
  const allowedResult = await allowed.client.callTool({
    name: "discord_end_poll",
    arguments: { channel_id: channelId, message_id: messageId },
  });
  expect(allowedResult.structuredContent).toEqual({ message: MESSAGE });
  expect(allowed.request(0).method).toBe("GET");
  expect(allowed.request(0).url).toBe(`https://discord.com/api/v10/channels/${channelId}`);
  expect(allowed.request(1).method).toBe("POST");
  expect(allowed.request(1).url).toBe("https://discord.com/api/v10/channels/100/polls/200/expire");

  const denied = await harness({
    policy: new PPolicyEngine(["500"], ["messages"], false),
    respond: () => ({ id: channelId, guild_id: "999" }),
  });
  const deniedResult = await denied.client.callTool({
    name: "discord_end_poll",
    arguments: { channel_id: channelId, message_id: messageId },
  });
  expect(errorOf(deniedResult)).toMatchObject({
    category: "policy",
    message: "Guild is not allowed",
  });
  expect(denied.makeRequest).toHaveBeenCalledTimes(1);
  expect(denied.request(0).method).toBe("GET");
  expect(denied.request(0).url).toBe(`https://discord.com/api/v10/channels/${channelId}`);
});
