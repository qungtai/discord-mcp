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

it("gets channel member permissions with channel_id, user_id and implicit flag", async () => {
  const { client, request } = await harness({
    policy: new PPolicyEngine([], ["channels"], false),
    respond: () => ({ permissions: "104324673" }),
  });
  const result = await client.callTool({
    name: "discord_get_member_permissions",
    arguments: {
      channel_id: "100",
      user_id: "200",
      implicit: true,
    },
  });
  expect(result.structuredContent).toEqual({ permissions: "104324673" });
  const req = request();
  expect([req.method, req.url]).toEqual([
    "GET",
    "https://discord.com/api/v10/channels/100/permissions/member/200?implicit=true",
  ]);
});

it("gets guild member permissions with guild_id and user_id without implicit flag", async () => {
  const { client, request } = await harness({
    policy: new PPolicyEngine([], ["channels"], false),
    respond: () => ({ permissions: "8" }),
  });
  const result = await client.callTool({
    name: "discord_get_member_permissions",
    arguments: {
      guild_id: "300",
      user_id: "200",
    },
  });
  expect(result.structuredContent).toEqual({ permissions: "8" });
  const req = request();
  expect([req.method, req.url]).toEqual([
    "GET",
    "https://discord.com/api/v10/guilds/300/permissions/member/200",
  ]);
});

it("rejects input with neither or both of guild_id and channel_id", async () => {
  const { client, makeRequest } = await harness({
    policy: new PPolicyEngine([], ["channels"], false),
  });
  const neither = await client.callTool({
    name: "discord_get_member_permissions",
    arguments: { user_id: "200" },
  });
  expect(errorOf(neither)).toMatchObject({
    category: "validation",
    remediation: "pass exactly one of guild_id, channel_id",
  });

  const both = await client.callTool({
    name: "discord_get_member_permissions",
    arguments: { guild_id: "300", channel_id: "100", user_id: "200" },
  });
  expect(errorOf(both)).toMatchObject({
    category: "validation",
    remediation: "pass exactly one of guild_id, channel_id",
  });
  expect(makeRequest).not.toHaveBeenCalled();
});

it("rejects implicit flag with guild_id", async () => {
  const { client, makeRequest } = await harness({
    policy: new PPolicyEngine([], ["channels"], false),
  });
  const result = await client.callTool({
    name: "discord_get_member_permissions",
    arguments: { guild_id: "300", user_id: "200", implicit: true },
  });
  expect(errorOf(result)).toMatchObject({
    category: "validation",
    remediation: "Remove implicit when querying guild member permissions",
  });
  expect(makeRequest).not.toHaveBeenCalled();
});

it("maps 403 to permission with ViewChannel requirement", async () => {
  const { client } = await harness({
    policy: new PPolicyEngine([], ["channels"], false),
    makeRequest: async () => json({ message: "Missing Permissions", code: 50013 }, { status: 403 }),
  });
  const result = await client.callTool({
    name: "discord_get_member_permissions",
    arguments: { channel_id: "100", user_id: "200" },
  });
  expect(errorOf(result)).toMatchObject({
    category: "permission",
    status: 403,
    discord_code: 50013,
    remediation: "Check the bot permissions; this tool needs ViewChannel",
  });
});

it("maps 404 to not_found", async () => {
  const { client } = await harness({
    policy: new PPolicyEngine([], ["channels"], false),
    makeRequest: async () => json({ message: "Unknown Member", code: 10007 }, { status: 404 }),
  });
  const result = await client.callTool({
    name: "discord_get_member_permissions",
    arguments: { channel_id: "100", user_id: "200" },
  });
  expect(errorOf(result)).toMatchObject({
    category: "not_found",
    status: 404,
  });
});

it("succeeds when channel/guild is in allowlist and denies when it is not", async () => {
  const allowedChannel = await harness({
    policy: new PPolicyEngine(["500"], ["channels"], false),
    makeRequest: async (url) => {
      const u = String(url);
      if (u.endsWith("/channels/100")) return json({ id: "100", guild_id: "500" });
      return json({ permissions: "8" });
    },
  });
  const res1 = await allowedChannel.client.callTool({
    name: "discord_get_member_permissions",
    arguments: { channel_id: "100", user_id: "200" },
  });
  expect(res1.structuredContent).toEqual({ permissions: "8" });
  expect(allowedChannel.makeRequest).toHaveBeenCalledTimes(2);
  expect(allowedChannel.request(0)).toMatchObject({
    method: "GET",
    url: "https://discord.com/api/v10/channels/100",
  });
  expect(allowedChannel.request(1)).toMatchObject({
    method: "GET",
    url: "https://discord.com/api/v10/channels/100/permissions/member/200",
  });

  const deniedChannel = await harness({
    policy: new PPolicyEngine(["500"], ["channels"], false),
    respond: () => ({ id: "100", guild_id: "999" }),
  });
  const res2 = await deniedChannel.client.callTool({
    name: "discord_get_member_permissions",
    arguments: { channel_id: "100", user_id: "200" },
  });
  expect(errorOf(res2)).toMatchObject({
    category: "policy",
    message: "Guild is not allowed",
  });
  expect(deniedChannel.makeRequest).toHaveBeenCalledTimes(1);
  expect(deniedChannel.request(0)).toMatchObject({
    method: "GET",
    url: "https://discord.com/api/v10/channels/100",
  });

  const allowedGuild = await harness({
    policy: new PPolicyEngine(["500"], ["channels"], false),
    respond: () => ({ permissions: "8" }),
  });
  const res3 = await allowedGuild.client.callTool({
    name: "discord_get_member_permissions",
    arguments: { guild_id: "500", user_id: "200" },
  });
  expect(res3.structuredContent).toEqual({ permissions: "8" });
  expect(allowedGuild.makeRequest).toHaveBeenCalledTimes(1);
  expect(allowedGuild.request(0)).toMatchObject({
    method: "GET",
    url: "https://discord.com/api/v10/guilds/500/permissions/member/200",
  });

  const deniedGuild = await harness({
    policy: new PPolicyEngine(["500"], ["channels"], false),
    respond: () => ({ permissions: "8" }),
  });
  const res4 = await deniedGuild.client.callTool({
    name: "discord_get_member_permissions",
    arguments: { guild_id: "999", user_id: "200" },
  });
  expect(errorOf(res4)).toMatchObject({
    category: "policy",
    message: "Guild is not allowed",
  });
  expect(deniedGuild.makeRequest).not.toHaveBeenCalled();
});
