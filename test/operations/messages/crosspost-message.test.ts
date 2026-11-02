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

const args = { channel_id: "1", message_id: "2" };

it("crossposts a message", async () => {
  const { client, request } = await harness({ respond: () => MESSAGE });
  const result = await client.callTool({
    name: "discord_crosspost_message",
    arguments: args,
  });
  const { url, method } = request();
  expect([method, url]).toEqual([
    "POST",
    "https://discord.com/api/v10/channels/1/messages/2/crosspost",
  ]);
  expect(result.structuredContent).toEqual({ message: MESSAGE });
});

it("allows access under an allowed guild", async () => {
  const { client } = await harness({
    policy: new PPolicyEngine(["100"], ["core", "messages"], false),
    makeRequest: async (url) => {
      if (String(url).endsWith("/channels/1")) return json({ id: "1", guild_id: "100" });
      return json(MESSAGE);
    },
  });
  const result = await client.callTool({
    name: "discord_crosspost_message",
    arguments: args,
  });
  expect(result.structuredContent).toEqual({ message: MESSAGE });
});

it("blocks access when channel belongs to a disallowed guild", async () => {
  const { client, makeRequest } = await harness({
    policy: new PPolicyEngine(["100"], ["core", "messages"], false),
    respond: () => ({ id: "1", guild_id: "200" }),
  });
  const result = await client.callTool({
    name: "discord_crosspost_message",
    arguments: args,
  });
  expect(errorOf(result)).toMatchObject({ category: "policy", message: "Guild is not allowed" });
  expect(makeRequest).toHaveBeenCalledTimes(1);
});

it("blocks mutating call in read-only mode", async () => {
  const { client, makeRequest } = await harness({
    policy: new PPolicyEngine([], ["messages"], true),
  });
  const result = await client.callTool({
    name: "discord_crosspost_message",
    arguments: args,
  });
  expect(errorOf(result)).toMatchObject({ category: "policy", message: "Read-only mode" });
  expect(makeRequest).not.toHaveBeenCalled();
});

it("maps a 403 to permission error", async () => {
  const { pipeline } = await harness({
    makeRequest: async () => json({ message: "Missing Permissions", code: 50013 }, { status: 403 }),
  });
  expect(await pipeline.call("discord_crosspost_message", args)).toMatchObject({
    ok: false,
    error: {
      category: "permission",
      retryable: false,
      status: 403,
      discord_code: 50013,
      remediation:
        "Check the bot permissions; this tool needs ViewChannel, SendMessages, ManageMessages",
    },
  });
});
