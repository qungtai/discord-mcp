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

const channelId = "100";
const messageId = "200";
const emoji = "👍";
const users = [
  { id: "301", username: "user1", bot: false },
  { id: "302", username: "user2", bot: false },
];

it("lists message reactions by emoji with query parameters and paging cursor", async () => {
  const { client, request } = await harness({
    policy: new PPolicyEngine([], ["reactions"], false),
    respond: () => users,
  });
  const result = await client.callTool({
    name: "discord_list_message_reactions_by_emoji",
    arguments: {
      channel_id: channelId,
      message_id: messageId,
      emoji,
      after: "300",
      limit: 10,
      type: 1,
    },
  });
  const req = request();
  expect([req.method, req.url]).toEqual([
    "GET",
    "https://discord.com/api/v10/channels/100/messages/200/reactions/%F0%9F%91%8D?after=300&limit=10&type=1",
  ]);
  expect(result.structuredContent).toEqual({
    users,
    next_after: "302",
  });
});

it("returns null next_after when user list is empty", async () => {
  const { client } = await harness({
    policy: new PPolicyEngine([], ["reactions"], false),
    respond: () => [],
  });
  const result = await client.callTool({
    name: "discord_list_message_reactions_by_emoji",
    arguments: { channel_id: channelId, message_id: messageId, emoji },
  });
  expect(result.structuredContent).toEqual({
    users: [],
    next_after: null,
  });
});

it("supports custom emoji", async () => {
  const customEmoji = "party_blob:123456789";
  const { client, request } = await harness({
    policy: new PPolicyEngine([], ["reactions"], false),
    respond: () => users,
  });
  const result = await client.callTool({
    name: "discord_list_message_reactions_by_emoji",
    arguments: { channel_id: channelId, message_id: messageId, emoji: customEmoji },
  });
  expect(result.isError).toBeFalsy();
  expect(request().url).toBe(
    "https://discord.com/api/v10/channels/100/messages/200/reactions/party_blob%3A123456789",
  );
});

it.each([
  ["invalid channel_id", { channel_id: "not-a-snowflake", message_id: messageId, emoji }],
  ["empty emoji", { channel_id: channelId, message_id: messageId, emoji: "" }],
  ["limit < 1", { channel_id: channelId, message_id: messageId, emoji, limit: 0 }],
  ["limit > 100", { channel_id: channelId, message_id: messageId, emoji, limit: 101 }],
  ["invalid type", { channel_id: channelId, message_id: messageId, emoji, type: 2 }],
  ["unknown extra property", { channel_id: channelId, message_id: messageId, emoji, extra: 1 }],
])("validates input strictly: %s", async (_, args) => {
  const { client, makeRequest } = await harness({
    policy: new PPolicyEngine([], ["reactions"], false),
  });
  const result = await client.callTool({
    name: "discord_list_message_reactions_by_emoji",
    arguments: args,
  });
  expect(errorOf(result)).toMatchObject({ category: "validation" });
  expect(makeRequest).not.toHaveBeenCalled();
});

it("maps 403 to permission error with ViewChannel and ReadMessageHistory", async () => {
  const { client } = await harness({
    policy: new PPolicyEngine([], ["reactions"], false),
    makeRequest: async () => json({ message: "Missing Permissions", code: 50013 }, { status: 403 }),
  });
  const result = await client.callTool({
    name: "discord_list_message_reactions_by_emoji",
    arguments: { channel_id: channelId, message_id: messageId, emoji },
  });
  expect(errorOf(result)).toMatchObject({
    category: "permission",
    status: 403,
    discord_code: 50013,
    remediation: "Check the bot permissions; this tool needs ViewChannel, ReadMessageHistory",
  });
});

it("maps 404 to not_found", async () => {
  const { client } = await harness({
    policy: new PPolicyEngine([], ["reactions"], false),
    makeRequest: async () => json({ message: "Unknown Message", code: 10008 }, { status: 404 }),
  });
  const result = await client.callTool({
    name: "discord_list_message_reactions_by_emoji",
    arguments: { channel_id: channelId, message_id: messageId, emoji },
  });
  expect(errorOf(result)).toMatchObject({
    category: "not_found",
    status: 404,
  });
});

it("allows access under an allowed guild and denies under disallowed guild", async () => {
  const allowed = await harness({
    policy: new PPolicyEngine(["500"], ["reactions"], false),
    makeRequest: async (url) => {
      if (String(url).endsWith(`/channels/${channelId}`)) {
        return json({ id: channelId, guild_id: "500" });
      }
      return json(users);
    },
  });
  const allowedResult = await allowed.client.callTool({
    name: "discord_list_message_reactions_by_emoji",
    arguments: { channel_id: channelId, message_id: messageId, emoji },
  });
  expect(allowedResult.structuredContent).toEqual({
    users,
    next_after: "302",
  });
  expect(allowed.request(0).method).toBe("GET");
  expect(allowed.request(0).url).toBe(`https://discord.com/api/v10/channels/${channelId}`);
  expect(allowed.request(1).method).toBe("GET");
  expect(allowed.request(1).url).toBe(
    "https://discord.com/api/v10/channels/100/messages/200/reactions/%F0%9F%91%8D",
  );

  const denied = await harness({
    policy: new PPolicyEngine(["500"], ["reactions"], false),
    respond: () => ({ id: channelId, guild_id: "999" }),
  });
  const deniedResult = await denied.client.callTool({
    name: "discord_list_message_reactions_by_emoji",
    arguments: { channel_id: channelId, message_id: messageId, emoji },
  });
  expect(errorOf(deniedResult)).toMatchObject({
    category: "policy",
    message: "Guild is not allowed",
  });
  expect(denied.makeRequest).toHaveBeenCalledTimes(1);
  expect(denied.request(0).method).toBe("GET");
  expect(denied.request(0).url).toBe(`https://discord.com/api/v10/channels/${channelId}`);
});
