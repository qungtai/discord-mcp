import type { ResponseLike } from "@discordjs/rest";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { PPolicyEngine } from "../../../src/core/policy.js";
import { PToolRegistry } from "../../../src/core/tool-registry.js";
import { deleteUserMessageReaction } from "../../../src/operations/reactions/delete-user-message-reaction.js";
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
const userId = "300";
const emoji = "👍";

it("deletes user reaction with ManageMessages permission after the client accepts approval", async () => {
  const registry = new PToolRegistry();
  registry.register(deleteUserMessageReaction);
  const { client, request } = await harness({
    registry,
    policy: new PPolicyEngine([], ["reactions"], false),
    makeRequest: async () => new Response(null, { status: 204 }) as unknown as ResponseLike,
  });
  const result = await client.callTool({
    name: "discord_delete_user_message_reaction",
    arguments: { channel_id: channelId, message_id: messageId, emoji, user_id: userId },
  });
  const req = request();
  expect([req.method, req.url]).toEqual([
    "DELETE",
    "https://discord.com/api/v10/channels/100/messages/200/reactions/%F0%9F%91%8D/300",
  ]);
  expect(result.structuredContent).toEqual({
    deleted: true,
    channel_id: channelId,
    message_id: messageId,
    emoji,
    user_id: userId,
  });
});

it("supports custom emoji", async () => {
  const customEmoji = "party_blob:123456789";
  const registry = new PToolRegistry();
  registry.register(deleteUserMessageReaction);
  const { client, request } = await harness({
    registry,
    policy: new PPolicyEngine([], ["reactions"], false),
    makeRequest: async () => new Response(null, { status: 204 }) as unknown as ResponseLike,
  });
  const result = await client.callTool({
    name: "discord_delete_user_message_reaction",
    arguments: {
      channel_id: channelId,
      message_id: messageId,
      emoji: customEmoji,
      user_id: userId,
    },
  });
  expect(result.isError).toBeFalsy();
  expect(request().url).toBe(
    "https://discord.com/api/v10/channels/100/messages/200/reactions/party_blob%3A123456789/300",
  );
});

it.each([
  [
    "invalid channel_id",
    { channel_id: "not-a-snowflake", message_id: messageId, emoji, user_id: userId },
  ],
  ["empty emoji", { channel_id: channelId, message_id: messageId, emoji: "", user_id: userId }],
  [
    "unknown extra property",
    { channel_id: channelId, message_id: messageId, emoji, user_id: userId, extra: 1 },
  ],
])("validates input strictly: %s", async (_, args) => {
  const registry = new PToolRegistry();
  registry.register(deleteUserMessageReaction);
  const { client, makeRequest } = await harness({
    registry,
    policy: new PPolicyEngine([], ["reactions"], false),
  });
  const result = await client.callTool({
    name: "discord_delete_user_message_reaction",
    arguments: args,
  });
  expect(errorOf(result)).toMatchObject({ category: "validation" });
  expect(makeRequest).not.toHaveBeenCalled();
});

it("maps 403 to permission error with ManageMessages", async () => {
  const registry = new PToolRegistry();
  registry.register(deleteUserMessageReaction);
  const { client } = await harness({
    registry,
    policy: new PPolicyEngine([], ["reactions"], false),
    makeRequest: async () => json({ message: "Missing Permissions", code: 50013 }, { status: 403 }),
  });
  const result = await client.callTool({
    name: "discord_delete_user_message_reaction",
    arguments: { channel_id: channelId, message_id: messageId, emoji, user_id: userId },
  });
  expect(errorOf(result)).toMatchObject({
    category: "permission",
    status: 403,
    discord_code: 50013,
    remediation: "Check the bot permissions; this tool needs ManageMessages",
  });
});

it("maps 404 to not_found", async () => {
  const registry = new PToolRegistry();
  registry.register(deleteUserMessageReaction);
  const { client } = await harness({
    registry,
    policy: new PPolicyEngine([], ["reactions"], false),
    makeRequest: async () => json({ message: "Unknown Message", code: 10008 }, { status: 404 }),
  });
  const result = await client.callTool({
    name: "discord_delete_user_message_reaction",
    arguments: { channel_id: channelId, message_id: messageId, emoji, user_id: userId },
  });
  expect(errorOf(result)).toMatchObject({
    category: "not_found",
    status: 404,
  });
});

it("allows access under an allowed guild and denies under disallowed guild", async () => {
  const registry = new PToolRegistry();
  registry.register(deleteUserMessageReaction);
  const allowed = await harness({
    registry,
    policy: new PPolicyEngine(["500"], ["reactions"], false),
    makeRequest: async (url) => {
      if (String(url).endsWith(`/channels/${channelId}`)) {
        return json({ id: channelId, guild_id: "500" });
      }
      return new Response(null, { status: 204 }) as unknown as ResponseLike;
    },
  });
  const allowedResult = await allowed.client.callTool({
    name: "discord_delete_user_message_reaction",
    arguments: { channel_id: channelId, message_id: messageId, emoji, user_id: userId },
  });
  expect(allowedResult.structuredContent).toEqual({
    deleted: true,
    channel_id: channelId,
    message_id: messageId,
    emoji,
    user_id: userId,
  });
  expect(allowed.request(0).method).toBe("GET");
  expect(allowed.request(0).url).toBe(`https://discord.com/api/v10/channels/${channelId}`);
  expect(allowed.request(1).method).toBe("DELETE");
  expect(allowed.request(1).url).toBe(
    "https://discord.com/api/v10/channels/100/messages/200/reactions/%F0%9F%91%8D/300",
  );

  const denied = await harness({
    registry,
    policy: new PPolicyEngine(["500"], ["reactions"], false),
    respond: () => ({ id: channelId, guild_id: "999" }),
  });
  const deniedResult = await denied.client.callTool({
    name: "discord_delete_user_message_reaction",
    arguments: { channel_id: channelId, message_id: messageId, emoji, user_id: userId },
  });
  expect(errorOf(deniedResult)).toMatchObject({
    category: "policy",
    message: "Guild is not allowed",
  });
  expect(denied.makeRequest).toHaveBeenCalledTimes(1);
  expect(denied.request(0).method).toBe("GET");
  expect(denied.request(0).url).toBe(`https://discord.com/api/v10/channels/${channelId}`);
});
