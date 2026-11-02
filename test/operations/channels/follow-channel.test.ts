import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { PPolicyEngine } from "../../../src/core/policy.js";
import { errorOf, harness, json } from "../../support/harness.js";

beforeEach(() => {
  vi.spyOn(process.stderr, "write").mockReturnValue(true);
});
afterEach(() => {
  vi.restoreAllMocks();
});

const FOLLOWER_RESPONSE = {
  channel_id: "100",
  webhook_id: "300",
};

it("follows an announcement channel to send messages to a target webhook channel with reason header", async () => {
  const { client, request } = await harness({
    policy: new PPolicyEngine([], ["channels"], false),
    respond: () => FOLLOWER_RESPONSE,
  });
  const result = await client.callTool({
    name: "discord_follow_channel",
    arguments: {
      channel_id: "100",
      webhook_channel_id: "200",
      reason: "Following announcement channel",
    },
  });

  const req = request();
  expect(req.method).toBe("POST");
  expect(req.url).toBe("https://discord.com/api/v10/channels/100/followers");
  expect(new Headers(req.headers as HeadersInit).get("x-audit-log-reason")).toBe(
    encodeURIComponent("Following announcement channel"),
  );
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

it.each([
  { input: { channel_id: "invalid", webhook_channel_id: "200" }, desc: "invalid channel_id" },
  {
    input: { channel_id: "100", webhook_channel_id: "invalid" },
    desc: "invalid webhook_channel_id",
  },
  { input: { channel_id: "100", webhook_channel_id: "200", extra: "extra" }, desc: "unknown key" },
])("validates input: $desc", async ({ input }) => {
  const { client, makeRequest } = await harness({
    policy: new PPolicyEngine([], ["channels"], false),
  });
  const result = await client.callTool({
    name: "discord_follow_channel",
    arguments: input,
  });
  expect(errorOf(result)).toMatchObject({ category: "validation" });
  expect(makeRequest).not.toHaveBeenCalled();
});

it.each([
  [403, 50013, "permission", "Check the bot permissions; this tool needs ManageWebhooks"],
  [404, 10003, "not_found", "Check the IDs in the request"],
])("handles HTTP %i error", async (status, code, category, remediation) => {
  const { pipeline } = await harness({
    policy: new PPolicyEngine([], ["channels"], false),
    makeRequest: async () => json({ message: "Discord error", code }, { status }),
  });
  expect(
    await pipeline.call("discord_follow_channel", {
      channel_id: "100",
      webhook_channel_id: "200",
    }),
  ).toMatchObject({
    ok: false,
    error: {
      category,
      status,
      discord_code: code,
      remediation,
    },
  });
});
