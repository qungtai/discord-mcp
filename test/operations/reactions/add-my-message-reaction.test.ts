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

const channelId = "100";
const messageId = "200";
const emoji = "👍";

it("adds own reaction to a message", async () => {
  const { client, request } = await harness({
    policy: new PPolicyEngine([], ["reactions"], false),
    makeRequest: async () => new Response(null, { status: 204 }) as unknown as ResponseLike,
  });
  const result = await client.callTool({
    name: "discord_add_my_message_reaction",
    arguments: { channel_id: channelId, message_id: messageId, emoji },
  });
  const req = request();
  expect([req.method, req.url]).toEqual([
    "PUT",
    "https://discord.com/api/v10/channels/100/messages/200/reactions/%F0%9F%91%8D/@me",
  ]);
  expect(result.structuredContent).toEqual({
    added: true,
    channel_id: channelId,
    message_id: messageId,
    emoji,
  });
});

it("supports custom emoji", async () => {
  const customEmoji = "party_blob:123456789";
  const { client, request } = await harness({
    policy: new PPolicyEngine([], ["reactions"], false),
    makeRequest: async () => new Response(null, { status: 204 }) as unknown as ResponseLike,
  });
  const result = await client.callTool({
    name: "discord_add_my_message_reaction",
    arguments: { channel_id: channelId, message_id: messageId, emoji: customEmoji },
  });
  expect(result.isError).toBeFalsy();
  expect(request().url).toBe(
    "https://discord.com/api/v10/channels/100/messages/200/reactions/party_blob%3A123456789/@me",
  );
});

it.each([
  ["invalid channel_id", { channel_id: "not-a-snowflake", message_id: messageId, emoji }],
  ["empty emoji", { channel_id: channelId, message_id: messageId, emoji: "" }],
  ["unknown extra property", { channel_id: channelId, message_id: messageId, emoji, extra: 1 }],
])("validates input strictly: %s", async (_, args) => {
  const { client, makeRequest } = await harness({
    policy: new PPolicyEngine([], ["reactions"], false),
  });
  const result = await client.callTool({
    name: "discord_add_my_message_reaction",
    arguments: args,
  });
  expect(errorOf(result)).toMatchObject({ category: "validation" });
  expect(makeRequest).not.toHaveBeenCalled();
});

it("maps 403 to permission error with ViewChannel, ReadMessageHistory and AddReactions", async () => {
  const { client } = await harness({
    policy: new PPolicyEngine([], ["reactions"], false),
    makeRequest: async () => json({ message: "Missing Permissions", code: 50013 }, { status: 403 }),
  });
  const result = await client.callTool({
    name: "discord_add_my_message_reaction",
    arguments: { channel_id: channelId, message_id: messageId, emoji },
  });
  expect(errorOf(result)).toMatchObject({
    category: "permission",
    status: 403,
    discord_code: 50013,
    remediation:
      "Check the bot permissions; this tool needs ViewChannel, ReadMessageHistory, AddReactions",
  });
});

it("maps 404 to not_found", async () => {
  const { client } = await harness({
    policy: new PPolicyEngine([], ["reactions"], false),
    makeRequest: async () => json({ message: "Unknown Message", code: 10008 }, { status: 404 }),
  });
  const result = await client.callTool({
    name: "discord_add_my_message_reaction",
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
      return new Response(null, { status: 204 }) as unknown as ResponseLike;
    },
  });
  const allowedResult = await allowed.client.callTool({
    name: "discord_add_my_message_reaction",
    arguments: { channel_id: channelId, message_id: messageId, emoji },
  });
  expect(allowedResult.structuredContent).toEqual({
    added: true,
    channel_id: channelId,
    message_id: messageId,
    emoji,
  });
  expect(allowed.request(0).method).toBe("GET");
  expect(allowed.request(0).url).toBe(`https://discord.com/api/v10/channels/${channelId}`);
  expect(allowed.request(1).method).toBe("PUT");
  expect(allowed.request(1).url).toBe(
    "https://discord.com/api/v10/channels/100/messages/200/reactions/%F0%9F%91%8D/@me",
  );

  const denied = await harness({
    policy: new PPolicyEngine(["500"], ["reactions"], false),
    respond: () => ({ id: channelId, guild_id: "999" }),
  });
  const deniedResult = await denied.client.callTool({
    name: "discord_add_my_message_reaction",
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
