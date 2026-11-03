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

const INVITE = {
  code: "xyz123",
  guild_id: "500",
  channel: { id: "100" },
  uses: 0,
  max_uses: 10,
  max_age: 3600,
  temporary: false,
};

it("lists channel invites with literal method and route", async () => {
  const { client, request } = await harness({
    policy: new PPolicyEngine([], ["invites"], false),
    respond: () => [INVITE],
  });
  const result = await client.callTool({
    name: "discord_list_channel_invites",
    arguments: {
      channel_id: "100",
    },
  });
  expect(result.structuredContent).toEqual({
    invites: [INVITE],
  });
  const req = request();
  expect([req.method, req.url]).toEqual([
    "GET",
    "https://discord.com/api/v10/channels/100/invites",
  ]);
});

it("maps 403 to permission with ManageChannels requirement", async () => {
  const { client } = await harness({
    policy: new PPolicyEngine([], ["invites"], false),
    makeRequest: async () => json({ message: "Missing Permissions", code: 50013 }, { status: 403 }),
  });
  const result = await client.callTool({
    name: "discord_list_channel_invites",
    arguments: { channel_id: "100" },
  });
  expect(errorOf(result)).toMatchObject({
    category: "permission",
    status: 403,
    discord_code: 50013,
    remediation: "Check the bot permissions; this tool needs ManageChannels",
  });
});

it("maps 404 to not_found", async () => {
  const { client } = await harness({
    policy: new PPolicyEngine([], ["invites"], false),
    makeRequest: async () => json({ message: "Unknown Channel", code: 10003 }, { status: 404 }),
  });
  const result = await client.callTool({
    name: "discord_list_channel_invites",
    arguments: { channel_id: "100" },
  });
  expect(errorOf(result)).toMatchObject({
    category: "not_found",
    status: 404,
  });
});

it("succeeds when channel is in allowlist and denies when it is not", async () => {
  const allowed = await harness({
    policy: new PPolicyEngine(["500"], ["invites"], false),
    makeRequest: async (url) => {
      const u = String(url);
      if (u.endsWith("/channels/100")) {
        return json({ id: "100", guild_id: "500" });
      }
      return json([INVITE]);
    },
  });
  const successResult = await allowed.client.callTool({
    name: "discord_list_channel_invites",
    arguments: { channel_id: "100" },
  });
  expect(successResult.structuredContent).toEqual({
    invites: [INVITE],
  });
  expect(allowed.makeRequest).toHaveBeenCalledTimes(2);
  expect(allowed.request(0)).toMatchObject({
    method: "GET",
    url: "https://discord.com/api/v10/channels/100",
  });
  expect(allowed.request(1)).toMatchObject({
    method: "GET",
    url: "https://discord.com/api/v10/channels/100/invites",
  });

  const denied = await harness({
    policy: new PPolicyEngine(["500"], ["invites"], false),
    respond: () => ({ id: "100", guild_id: "999" }),
  });
  const deniedResult = await denied.client.callTool({
    name: "discord_list_channel_invites",
    arguments: { channel_id: "100" },
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
