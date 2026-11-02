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

async function toolHarness(options: Parameters<typeof harness>[0] = {}) {
  return harness({
    ...options,
    policy: options.policy ?? new PPolicyEngine([], ["channels"], false),
  });
}

it("updates voice channel status with literal method, route and body", async () => {
  const { client, request } = await toolHarness({
    respond: () => ({}),
  });
  const result = await client.callTool({
    name: "discord_update_voice_channel_status",
    arguments: {
      channel_id: "100",
      status: "Coding session",
    },
  });
  expect(result.structuredContent).toEqual({
    channel_id: "100",
    status: "Coding session",
    updated: true,
  });
  const req = request();
  expect([req.method, req.url]).toEqual([
    "PUT",
    "https://discord.com/api/v10/channels/100/voice-status",
  ]);
  expect(JSON.parse(String(req.body))).toEqual({
    status: "Coding session",
  });
});

it("clears voice channel status with null", async () => {
  const { client, request } = await toolHarness({
    respond: () => ({}),
  });
  const result = await client.callTool({
    name: "discord_update_voice_channel_status",
    arguments: {
      channel_id: "100",
      status: null,
    },
  });
  expect(result.structuredContent).toEqual({
    channel_id: "100",
    status: null,
    updated: true,
  });
  expect(JSON.parse(String(request().body))).toEqual({
    status: null,
  });
});

it("rejects status exceeding 500 characters", async () => {
  const { client, makeRequest } = await toolHarness();
  const result = await client.callTool({
    name: "discord_update_voice_channel_status",
    arguments: {
      channel_id: "100",
      status: "a".repeat(501),
    },
  });
  expect(errorOf(result)).toMatchObject({ category: "validation" });
  expect(makeRequest).not.toHaveBeenCalled();
});

it("maps 403 to permission with SetVoiceChannelStatus and Connect requirements", async () => {
  const { client } = await toolHarness({
    makeRequest: async () => json({ message: "Missing Permissions", code: 50013 }, { status: 403 }),
  });
  const result = await client.callTool({
    name: "discord_update_voice_channel_status",
    arguments: { channel_id: "100", status: "Chatting" },
  });
  expect(errorOf(result)).toMatchObject({
    category: "permission",
    status: 403,
    discord_code: 50013,
    remediation: "Check the bot permissions; this tool needs SetVoiceChannelStatus, Connect",
  });
});

it("maps 404 to not_found", async () => {
  const { client } = await toolHarness({
    makeRequest: async () => json({ message: "Unknown Channel", code: 10003 }, { status: 404 }),
  });
  const result = await client.callTool({
    name: "discord_update_voice_channel_status",
    arguments: { channel_id: "100", status: "Chatting" },
  });
  expect(errorOf(result)).toMatchObject({
    category: "not_found",
    status: 404,
  });
});

it("succeeds when channel is in allowlist and denies when it is not", async () => {
  const allowed = await toolHarness({
    policy: new PPolicyEngine(["500"], ["channels"], false),
    makeRequest: async (url) => {
      const u = String(url);
      if (u.endsWith("/channels/100")) return json({ id: "100", guild_id: "500" });
      return json({});
    },
  });
  const successResult = await allowed.client.callTool({
    name: "discord_update_voice_channel_status",
    arguments: { channel_id: "100", status: "Gaming" },
  });
  expect(successResult.structuredContent).toEqual({
    channel_id: "100",
    status: "Gaming",
    updated: true,
  });
  expect(allowed.makeRequest).toHaveBeenCalledTimes(2);
  expect(allowed.request(0)).toMatchObject({
    method: "GET",
    url: "https://discord.com/api/v10/channels/100",
  });
  expect(allowed.request(1)).toMatchObject({
    method: "PUT",
    url: "https://discord.com/api/v10/channels/100/voice-status",
  });

  const denied = await toolHarness({
    policy: new PPolicyEngine(["500"], ["channels"], false),
    respond: () => ({ id: "100", guild_id: "999" }),
  });
  const deniedResult = await denied.client.callTool({
    name: "discord_update_voice_channel_status",
    arguments: { channel_id: "100", status: "Gaming" },
  });
  expect(errorOf(deniedResult)).toMatchObject({
    category: "policy",
    message: "Guild is not allowed",
  });
  expect(denied.makeRequest).toHaveBeenCalledTimes(1);
  expect(denied.request(0)).toMatchObject({
    method: "GET",
    url: "https://discord.com/api/v10/channels/100",
  });
});
