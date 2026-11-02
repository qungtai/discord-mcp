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
    respond: () => null,
  });
  const result = await client.callTool({
    name: "discord_add_my_message_reaction",
    arguments: { channel_id: channelId, message_id: messageId, emoji },
  });
  const req = request();
  expect([req.method, req.url]).toEqual([
    "PUT",
    `https://discord.com/api/v10/channels/${channelId}/messages/${messageId}/reactions/${encodeURIComponent(emoji)}/@me`,
  ]);
  expect(result.structuredContent).toEqual({
    added: true,
    channel_id: channelId,
    message_id: messageId,
    emoji,
  });
});

it("validates input strictly", async () => {
  const { client, makeRequest } = await harness({
    policy: new PPolicyEngine([], ["reactions"], false),
  });
  const result = await client.callTool({
    name: "discord_add_my_message_reaction",
    arguments: { channel_id: "not-a-snowflake", message_id: messageId, emoji },
  });
  expect(errorOf(result)).toMatchObject({ category: "validation" });
  expect(makeRequest).not.toHaveBeenCalled();
});

it("maps 403 to permission error with ReadMessageHistory and AddReactions", async () => {
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
    remediation: "Check the bot permissions; this tool needs ReadMessageHistory, AddReactions",
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
    respond: () => ({ id: channelId, guild_id: "500" }),
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
});
