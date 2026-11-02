import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { PPolicyEngine } from "../../../src/core/policy.js";
import { PToolRegistry } from "../../../src/core/tool-registry.js";
import { updateGuildMember } from "../../../src/operations/members/update-guild-member.js";
import { errorOf, harness, json } from "../../support/harness.js";

beforeEach(() => {
  vi.spyOn(process.stderr, "write").mockReturnValue(true);
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const UPDATED_MEMBER = {
  user: { id: "456", username: "charlie", bot: false },
  nick: "Chuck Updated",
  roles: ["301", "303"],
  joined_at: "2026-01-01T00:00:00.000Z",
};

it("refuses to run when the client cannot ask for approval", async () => {
  const { pipeline } = await harness({
    clientCapabilities: {},
    policy: new PPolicyEngine([], ["members"], false),
  });
  expect(
    await pipeline.call("discord_update_guild_member", {
      guild_id: "123",
      user_id: "456",
      nick: "NewNick",
    }),
  ).toMatchObject({
    ok: false,
    error: {
      category: "policy",
      message: "This tool needs approval but the client does not support elicitation",
      remediation:
        "Use an MCP client that supports elicitation, or set DISCORD_MCP_APPROVAL=none to rely on the client's own tool approval",
    },
  });
});

it("updates a guild member with reason and fields after the client accepts approval", async () => {
  const registry = new PToolRegistry();
  registry.register(updateGuildMember);
  const { client, request } = await harness({
    registry,
    policy: new PPolicyEngine([], ["members"], false),
    respond: () => UPDATED_MEMBER,
  });
  const result = await client.callTool({
    name: "discord_update_guild_member",
    arguments: {
      guild_id: "123",
      user_id: "456",
      nick: "Chuck Updated",
      roles: ["301", "303"],
      mute: false,
      deaf: false,
      channel_id: "789",
      communication_disabled_until: "2026-12-01T00:00:00.000Z",
      flags: 0,
      reason: "Promoting member",
    },
  });
  const req = request();
  expect(req.method).toBe("PATCH");
  expect(req.url).toBe("https://discord.com/api/v10/guilds/123/members/456");
  expect(new Headers(req.headers as HeadersInit).get("x-audit-log-reason")).toBe(
    encodeURIComponent("Promoting member"),
  );
  expect(JSON.parse(String(req.body))).toEqual({
    nick: "Chuck Updated",
    roles: ["301", "303"],
    mute: false,
    deaf: false,
    channel_id: "789",
    communication_disabled_until: "2026-12-01T00:00:00.000Z",
    flags: 0,
  });
  expect(result.structuredContent).toEqual({
    member: UPDATED_MEMBER,
  });
});

it("passes allowlist check with channel_id in allowed guild", async () => {
  const registry = new PToolRegistry();
  registry.register(updateGuildMember);
  const { client, request, makeRequest } = await harness({
    registry,
    policy: new PPolicyEngine(["123"], ["members"], false),
    makeRequest: async (url) => {
      if (String(url).includes("/channels/789")) {
        return json({ id: "789", guild_id: "123" });
      }
      return json(UPDATED_MEMBER);
    },
  });
  const result = await client.callTool({
    name: "discord_update_guild_member",
    arguments: { guild_id: "123", user_id: "456", channel_id: "789", nick: "NewNick" },
  });
  expect(result.structuredContent).toEqual({ member: UPDATED_MEMBER });
  expect(makeRequest).toHaveBeenCalledTimes(2);
  expect(request(0)).toMatchObject({
    method: "GET",
    url: "https://discord.com/api/v10/channels/789",
  });
  expect(request(1)).toMatchObject({
    method: "PATCH",
    url: "https://discord.com/api/v10/guilds/123/members/456",
  });
});

it("denies access when channel_id resolves to an unallowed guild", async () => {
  const registry = new PToolRegistry();
  registry.register(updateGuildMember);
  const { client, makeRequest } = await harness({
    registry,
    policy: new PPolicyEngine(["123"], ["members"], false),
    makeRequest: async (url) => {
      if (String(url).includes("/channels/789")) {
        return json({ id: "789", guild_id: "999" });
      }
      return json(UPDATED_MEMBER);
    },
  });
  const result = await client.callTool({
    name: "discord_update_guild_member",
    arguments: { guild_id: "123", user_id: "456", channel_id: "789", nick: "NewNick" },
  });
  expect(errorOf(result)).toMatchObject({
    category: "policy",
    message: "Guild is not allowed",
  });
  expect(makeRequest).toHaveBeenCalledTimes(1);
});

it("denies access when guild is not allowed", async () => {
  const registry = new PToolRegistry();
  registry.register(updateGuildMember);
  const { client, makeRequest } = await harness({
    registry,
    policy: new PPolicyEngine(["999"], ["members"], false),
  });
  const result = await client.callTool({
    name: "discord_update_guild_member",
    arguments: { guild_id: "123", user_id: "456", nick: "NewNick" },
  });
  expect(errorOf(result)).toMatchObject({
    category: "policy",
    message: "Guild is not allowed",
  });
  expect(makeRequest).not.toHaveBeenCalled();
});

it("blocks execution in read-only mode", async () => {
  const registry = new PToolRegistry();
  registry.register(updateGuildMember);
  const { pipeline, makeRequest } = await harness({
    registry,
    policy: new PPolicyEngine([], ["members"], true),
  });
  const result = await pipeline.call("discord_update_guild_member", {
    guild_id: "123",
    user_id: "456",
    nick: "NewNick",
  });
  expect(result).toMatchObject({
    error: { category: "policy", message: "Read-only mode" },
  });
  expect(makeRequest).not.toHaveBeenCalled();
});

it.each([
  ["nick > 32 chars", { guild_id: "123", user_id: "456", nick: "a".repeat(33) }],
  [
    "invalid datetime format",
    { guild_id: "123", user_id: "456", communication_disabled_until: "not-a-datetime" },
  ],
  ["invalid snowflake channel_id", { guild_id: "123", user_id: "456", channel_id: "bad_channel" }],
])("validates input strictly: %s", async (_, args) => {
  const registry = new PToolRegistry();
  registry.register(updateGuildMember);
  const { client, makeRequest } = await harness({
    registry,
    policy: new PPolicyEngine([], ["members"], false),
  });
  const result = await client.callTool({
    name: "discord_update_guild_member",
    arguments: args,
  });
  expect(errorOf(result)).toMatchObject({ category: "validation" });
  expect(makeRequest).not.toHaveBeenCalled();
});

it("handles 403 missing permissions error", async () => {
  const registry = new PToolRegistry();
  registry.register(updateGuildMember);
  const { client } = await harness({
    registry,
    policy: new PPolicyEngine([], ["members"], false),
    makeRequest: async () => json({ message: "Missing Permissions", code: 50013 }, { status: 403 }),
  });
  const result = await client.callTool({
    name: "discord_update_guild_member",
    arguments: {
      guild_id: "123",
      user_id: "456",
      nick: "NewNick",
    },
  });
  expect(errorOf(result)).toMatchObject({
    category: "permission",
    status: 403,
    discord_code: 50013,
    remediation:
      "Check the bot permissions; this tool needs ManageNicknames, ManageRoles, MuteMembers, DeafenMembers, MoveMembers, ModerateMembers",
  });
});

it("handles 404 error", async () => {
  const registry = new PToolRegistry();
  registry.register(updateGuildMember);
  const { client } = await harness({
    registry,
    policy: new PPolicyEngine([], ["members"], false),
    makeRequest: async () => json({ message: "Unknown Member", code: 10007 }, { status: 404 }),
  });
  const result = await client.callTool({
    name: "discord_update_guild_member",
    arguments: {
      guild_id: "123",
      user_id: "456",
      nick: "NewNick",
    },
  });
  expect(errorOf(result)).toMatchObject({
    category: "not_found",
    status: 404,
    discord_code: 10007,
    remediation: "Check the IDs in the request",
  });
});
