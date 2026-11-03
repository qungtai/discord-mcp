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
const answerId = 1;
const votersResult = {
  users: [
    { id: "301", username: "voter1", bot: false },
    { id: "302", username: "voter2", bot: false },
  ],
};

it("gets poll answer voters with query parameters and paging cursor", async () => {
  const { client, request } = await harness({
    policy: new PPolicyEngine([], ["messages"], false),
    respond: () => votersResult,
  });
  const result = await client.callTool({
    name: "discord_list_poll_answer_voters",
    arguments: {
      channel_id: channelId,
      message_id: messageId,
      answer_id: answerId,
      after: "300",
      limit: 10,
    },
  });
  const req = request();
  expect([req.method, req.url]).toEqual([
    "GET",
    "https://discord.com/api/v10/channels/100/polls/200/answers/1?after=300&limit=10",
  ]);
  expect(result.structuredContent).toEqual({
    users: votersResult.users,
    next_after: "302",
  });
});

it("returns null next_after when voters list is empty", async () => {
  const { client } = await harness({
    policy: new PPolicyEngine([], ["messages"], false),
    respond: () => ({ users: [] }),
  });
  const result = await client.callTool({
    name: "discord_list_poll_answer_voters",
    arguments: { channel_id: channelId, message_id: messageId, answer_id: answerId },
  });
  expect(result.structuredContent).toEqual({
    users: [],
    next_after: null,
  });
});

it.each([
  ["invalid channel_id", { channel_id: "not-a-snowflake", message_id: messageId, answer_id: 1 }],
  ["answer_id < 1", { channel_id: channelId, message_id: messageId, answer_id: 0 }],
  ["limit < 1", { channel_id: channelId, message_id: messageId, answer_id: 1, limit: 0 }],
  ["limit > 100", { channel_id: channelId, message_id: messageId, answer_id: 1, limit: 101 }],
  [
    "unknown extra property",
    { channel_id: channelId, message_id: messageId, answer_id: 1, extra: 1 },
  ],
])("validates input strictly: %s", async (_, args) => {
  const { client, makeRequest } = await harness({
    policy: new PPolicyEngine([], ["messages"], false),
  });
  const result = await client.callTool({
    name: "discord_list_poll_answer_voters",
    arguments: args,
  });
  expect(errorOf(result)).toMatchObject({ category: "validation" });
  expect(makeRequest).not.toHaveBeenCalled();
});

it("maps 403 to permission error with ViewChannel and ReadMessageHistory", async () => {
  const { client } = await harness({
    policy: new PPolicyEngine([], ["messages"], false),
    makeRequest: async () => json({ message: "Missing Permissions", code: 50013 }, { status: 403 }),
  });
  const result = await client.callTool({
    name: "discord_list_poll_answer_voters",
    arguments: { channel_id: channelId, message_id: messageId, answer_id: answerId },
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
    policy: new PPolicyEngine([], ["messages"], false),
    makeRequest: async () => json({ message: "Unknown Message", code: 10008 }, { status: 404 }),
  });
  const result = await client.callTool({
    name: "discord_list_poll_answer_voters",
    arguments: { channel_id: channelId, message_id: messageId, answer_id: answerId },
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
      return json(votersResult);
    },
  });
  const allowedResult = await allowed.client.callTool({
    name: "discord_list_poll_answer_voters",
    arguments: { channel_id: channelId, message_id: messageId, answer_id: answerId },
  });
  expect(allowedResult.structuredContent).toEqual({
    users: votersResult.users,
    next_after: "302",
  });
  expect(allowed.request(0).method).toBe("GET");
  expect(allowed.request(0).url).toBe(`https://discord.com/api/v10/channels/${channelId}`);
  expect(allowed.request(1).method).toBe("GET");
  expect(allowed.request(1).url).toBe(
    "https://discord.com/api/v10/channels/100/polls/200/answers/1",
  );

  const denied = await harness({
    policy: new PPolicyEngine(["500"], ["messages"], false),
    respond: () => ({ id: channelId, guild_id: "999" }),
  });
  const deniedResult = await denied.client.callTool({
    name: "discord_list_poll_answer_voters",
    arguments: { channel_id: channelId, message_id: messageId, answer_id: answerId },
  });
  expect(errorOf(deniedResult)).toMatchObject({
    category: "policy",
    message: "Guild is not allowed",
  });
  expect(denied.makeRequest).toHaveBeenCalledTimes(1);
  expect(denied.request(0).method).toBe("GET");
  expect(denied.request(0).url).toBe(`https://discord.com/api/v10/channels/${channelId}`);
});
