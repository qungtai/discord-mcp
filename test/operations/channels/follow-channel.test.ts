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

const FOLLOWER_RESPONSE = {
  channel_id: "100",
  webhook_id: "300",
};

it("follows an announcement channel to send messages to a target webhook channel", async () => {
  const { client, request } = await harness({
    policy: new PPolicyEngine([], ["channels"], false),
    respond: () => FOLLOWER_RESPONSE,
  });
  const result = await client.callTool({
    name: "discord_follow_channel",
    arguments: {
      channel_id: "100",
      webhook_channel_id: "200",
    },
  });

  const req = request();
  expect(req.method).toBe("POST");
  expect(req.url).toBe("https://discord.com/api/v10/channels/100/followers");
  expect(JSON.parse(String(req.body))).toEqual({
    webhook_channel_id: "200",
  });
  expect(result.structuredContent).toEqual(FOLLOWER_RESPONSE);
});

it("passes allowlist check when both source and target channels are in allowed guilds", async () => {
  const lookups: Record<string, unknown> = {
    "https://discord.com/api/v10/channels/100": { id: "100", guild_id: "500" },
    "https://discord.com/api/v10/channels/200": { id: "200", guild_id: "500" },
  };
  const { client, makeRequest } = await harness({
    policy: new PPolicyEngine(["500"], ["channels"], false),
    makeRequest: async (url, init) => {
      if (init?.method === "GET") {
        return json(lookups[String(url)] ?? {});
      }
      return json(FOLLOWER_RESPONSE);
    },
  });
  const result = await client.callTool({
    name: "discord_follow_channel",
    arguments: {
      channel_id: "100",
      webhook_channel_id: "200",
    },
  });
  expect(result.structuredContent).toEqual(FOLLOWER_RESPONSE);
  expect(makeRequest).toHaveBeenCalledTimes(3); // 2 lookups + 1 POST
});

it("denies access when a channel is in an unallowed guild", async () => {
  const lookups: Record<string, unknown> = {
    "https://discord.com/api/v10/channels/100": { id: "100", guild_id: "500" },
    "https://discord.com/api/v10/channels/200": { id: "200", guild_id: "999" },
  };
  const { client, makeRequest } = await harness({
    policy: new PPolicyEngine(["500"], ["channels"], false),
    makeRequest: async (url) => json(lookups[String(url)] ?? {}),
  });
  const result = await client.callTool({
    name: "discord_follow_channel",
    arguments: {
      channel_id: "100",
      webhook_channel_id: "200",
    },
  });
  expect(errorOf(result)).toMatchObject({
    category: "policy",
    message: "Guild is not allowed",
  });
  // Channel lookups happen, but POST write is never sent
  const methods = makeRequest.mock.calls.map(([, init]) => init?.method);
  expect(methods).not.toContain("POST");
});

it("blocks execution in read-only mode", async () => {
  const { pipeline, makeRequest } = await harness({
    policy: new PPolicyEngine([], ["channels"], true),
  });
  const result = await pipeline.call("discord_follow_channel", {
    channel_id: "100",
    webhook_channel_id: "200",
  });
  expect(result).toMatchObject({
    error: { category: "policy", message: "Read-only mode" },
  });
  expect(makeRequest).not.toHaveBeenCalled();
});

it("validates snowflake format", async () => {
  const { client, makeRequest } = await harness({
    policy: new PPolicyEngine([], ["channels"], false),
  });
  const result = await client.callTool({
    name: "discord_follow_channel",
    arguments: {
      channel_id: "invalid",
      webhook_channel_id: "200",
    },
  });
  expect(errorOf(result)).toMatchObject({ category: "validation" });
  expect(makeRequest).not.toHaveBeenCalled();
});

it("handles 403 missing permissions error", async () => {
  const { pipeline } = await harness({
    policy: new PPolicyEngine([], ["channels"], false),
    makeRequest: async () => json({ message: "Missing Permissions", code: 50013 }, { status: 403 }),
  });
  expect(
    await pipeline.call("discord_follow_channel", {
      channel_id: "100",
      webhook_channel_id: "200",
    }),
  ).toMatchObject({
    ok: false,
    error: {
      category: "permission",
      status: 403,
      discord_code: 50013,
      remediation: "Check the bot permissions; this tool needs ManageWebhooks",
    },
  });
});
