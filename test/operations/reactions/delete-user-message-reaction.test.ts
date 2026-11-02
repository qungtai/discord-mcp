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

it("has approval enabled by default and is blocked by policy until approval flow is supported", async () => {
  const { pipeline } = await harness({
    policy: new PPolicyEngine([], ["reactions"], false),
  });
  expect(
    await pipeline.call("discord_delete_user_message_reaction", {
      channel_id: channelId,
      message_id: messageId,
      emoji,
      user_id: userId,
    }),
  ).toMatchObject({
    ok: false,
    error: {
      category: "policy",
      message: "This tool requires approval support",
      remediation: "Wait for the approval flow",
    },
  });
});

it("deletes user reaction with ManageMessages permission when approval is satisfied", async () => {
  const registry = new PToolRegistry();
  registry.register({ ...deleteUserMessageReaction, approval: false });
  const { client, request } = await harness({
    registry,
    policy: new PPolicyEngine([], ["reactions"], false),
    respond: () => null,
  });
  const result = await client.callTool({
    name: "discord_delete_user_message_reaction",
    arguments: { channel_id: channelId, message_id: messageId, emoji, user_id: userId },
  });
  const req = request();
  expect([req.method, req.url]).toEqual([
    "DELETE",
    `https://discord.com/api/v10/channels/${channelId}/messages/${messageId}/reactions/${encodeURIComponent(emoji)}/${userId}`,
  ]);
  expect(result.structuredContent).toEqual({
    deleted: true,
    channel_id: channelId,
    message_id: messageId,
    emoji,
    user_id: userId,
  });
});

it("validates input strictly", async () => {
  const registry = new PToolRegistry();
  registry.register({ ...deleteUserMessageReaction, approval: false });
  const { client, makeRequest } = await harness({
    registry,
    policy: new PPolicyEngine([], ["reactions"], false),
  });
  const result = await client.callTool({
    name: "discord_delete_user_message_reaction",
    arguments: { channel_id: "not-a-snowflake", message_id: messageId, emoji, user_id: userId },
  });
  expect(errorOf(result)).toMatchObject({ category: "validation" });
  expect(makeRequest).not.toHaveBeenCalled();
});

it("maps 403 to permission error with ManageMessages", async () => {
  const registry = new PToolRegistry();
  registry.register({ ...deleteUserMessageReaction, approval: false });
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
  registry.register({ ...deleteUserMessageReaction, approval: false });
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
  registry.register({ ...deleteUserMessageReaction, approval: false });
  const allowed = await harness({
    registry,
    policy: new PPolicyEngine(["500"], ["reactions"], false),
    respond: () => ({ id: channelId, guild_id: "500" }),
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
});
