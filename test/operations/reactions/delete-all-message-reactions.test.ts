import type { ResponseLike } from "@discordjs/rest";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { PPolicyEngine } from "../../../src/core/policy.js";
import { PToolRegistry } from "../../../src/core/tool-registry.js";
import { deleteAllMessageReactions } from "../../../src/operations/reactions/delete-all-message-reactions.js";
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

it("deletes all reactions on a message with ManageMessages after the client accepts approval", async () => {
  const registry = new PToolRegistry();
  registry.register(deleteAllMessageReactions);
  const { client, request } = await harness({
    registry,
    policy: new PPolicyEngine([], ["reactions"], false),
    makeRequest: async () => new Response(null, { status: 204 }) as unknown as ResponseLike,
  });
  const result = await client.callTool({
    name: "discord_delete_all_message_reactions",
    arguments: { channel_id: channelId, message_id: messageId },
  });
  const req = request();
  expect([req.method, req.url]).toEqual([
    "DELETE",
    "https://discord.com/api/v10/channels/100/messages/200/reactions",
  ]);
  expect(result.structuredContent).toEqual({
    deleted: true,
    channel_id: channelId,
    message_id: messageId,
  });
});

it.each([
  ["invalid channel_id", { channel_id: "invalid-id", message_id: messageId }],
  ["invalid message_id", { channel_id: channelId, message_id: "invalid-id" }],
  ["unknown extra property", { channel_id: channelId, message_id: messageId, extra: 1 }],
])("validates input strictly: %s", async (_, args) => {
  const registry = new PToolRegistry();
  registry.register(deleteAllMessageReactions);
  const { client, makeRequest } = await harness({
    registry,
    policy: new PPolicyEngine([], ["reactions"], false),
  });
  const result = await client.callTool({
    name: "discord_delete_all_message_reactions",
    arguments: args,
  });
  expect(errorOf(result)).toMatchObject({ category: "validation" });
  expect(makeRequest).not.toHaveBeenCalled();
});

it("maps 403 to permission error with ManageMessages", async () => {
  const registry = new PToolRegistry();
  registry.register(deleteAllMessageReactions);
  const { client } = await harness({
    registry,
    policy: new PPolicyEngine([], ["reactions"], false),
    makeRequest: async () => json({ message: "Missing Permissions", code: 50013 }, { status: 403 }),
  });
  const result = await client.callTool({
    name: "discord_delete_all_message_reactions",
    arguments: { channel_id: channelId, message_id: messageId },
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
  registry.register(deleteAllMessageReactions);
  const { client } = await harness({
    registry,
    policy: new PPolicyEngine([], ["reactions"], false),
    makeRequest: async () => json({ message: "Unknown Message", code: 10008 }, { status: 404 }),
  });
  const result = await client.callTool({
    name: "discord_delete_all_message_reactions",
    arguments: { channel_id: channelId, message_id: messageId },
  });
  expect(errorOf(result)).toMatchObject({
    category: "not_found",
    status: 404,
  });
});

it("allows access under an allowed guild and denies under disallowed guild", async () => {
  const registry = new PToolRegistry();
  registry.register(deleteAllMessageReactions);
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
    name: "discord_delete_all_message_reactions",
    arguments: { channel_id: channelId, message_id: messageId },
  });
  expect(allowedResult.structuredContent).toEqual({
    deleted: true,
    channel_id: channelId,
    message_id: messageId,
  });
  expect(allowed.request(0).method).toBe("GET");
  expect(allowed.request(0).url).toBe(`https://discord.com/api/v10/channels/${channelId}`);
  expect(allowed.request(1).method).toBe("DELETE");
  expect(allowed.request(1).url).toBe(
    "https://discord.com/api/v10/channels/100/messages/200/reactions",
  );

  const denied = await harness({
    registry,
    policy: new PPolicyEngine(["500"], ["reactions"], false),
    respond: () => ({ id: channelId, guild_id: "999" }),
  });
  const deniedResult = await denied.client.callTool({
    name: "discord_delete_all_message_reactions",
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
