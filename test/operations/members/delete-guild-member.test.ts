import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { PPolicyEngine } from "../../../src/core/policy.js";
import { PToolRegistry } from "../../../src/core/tool-registry.js";
import { deleteGuildMember } from "../../../src/operations/members/delete-guild-member.js";
import { errorOf, harness, json } from "../../support/harness.js";

beforeEach(() => {
  vi.spyOn(process.stderr, "write").mockReturnValue(true);
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it("refuses to run when the client cannot ask for approval", async () => {
  const { pipeline } = await harness({
    clientCapabilities: {},
    policy: new PPolicyEngine([], ["members"], false),
  });
  expect(
    await pipeline.call("discord_delete_guild_member", {
      guild_id: "123",
      user_id: "456",
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

it("deletes (kicks) a guild member with reason after the client accepts approval", async () => {
  const registry = new PToolRegistry();
  registry.register(deleteGuildMember);
  const { client, request } = await harness({
    registry,
    policy: new PPolicyEngine([], ["members"], false),
    respond: () => null,
  });
  const result = await client.callTool({
    name: "discord_delete_guild_member",
    arguments: {
      guild_id: "123",
      user_id: "456",
      reason: "Rule violation",
    },
  });
  const req = request();
  expect(req.method).toBe("DELETE");
  expect(req.url).toBe("https://discord.com/api/v10/guilds/123/members/456");
  expect(new Headers(req.headers as HeadersInit).get("x-audit-log-reason")).toBe(
    encodeURIComponent("Rule violation"),
  );
  expect(result.structuredContent).toEqual({
    deleted: true,
    guild_id: "123",
    user_id: "456",
  });
});

it("passes allowlist check when guild is allowed", async () => {
  const registry = new PToolRegistry();
  registry.register(deleteGuildMember);
  const { client, request } = await harness({
    registry,
    policy: new PPolicyEngine(["123"], ["members"], false),
    respond: () => null,
  });
  const result = await client.callTool({
    name: "discord_delete_guild_member",
    arguments: { guild_id: "123", user_id: "456" },
  });
  expect(result.structuredContent).toEqual({
    deleted: true,
    guild_id: "123",
    user_id: "456",
  });
  expect(request()).toMatchObject({
    method: "DELETE",
    url: "https://discord.com/api/v10/guilds/123/members/456",
  });
});

it("denies access when guild is not allowed", async () => {
  const registry = new PToolRegistry();
  registry.register(deleteGuildMember);
  const { client, makeRequest } = await harness({
    registry,
    policy: new PPolicyEngine(["999"], ["members"], false),
  });
  const result = await client.callTool({
    name: "discord_delete_guild_member",
    arguments: { guild_id: "123", user_id: "456" },
  });
  expect(errorOf(result)).toMatchObject({
    category: "policy",
    message: "Guild is not allowed",
  });
  expect(makeRequest).not.toHaveBeenCalled();
});

it("blocks execution in read-only mode", async () => {
  const registry = new PToolRegistry();
  registry.register(deleteGuildMember);
  const { pipeline, makeRequest } = await harness({
    registry,
    policy: new PPolicyEngine([], ["members"], true),
  });
  const result = await pipeline.call("discord_delete_guild_member", {
    guild_id: "123",
    user_id: "456",
  });
  expect(result).toMatchObject({
    error: { category: "policy", message: "Read-only mode" },
  });
  expect(makeRequest).not.toHaveBeenCalled();
});

it.each([
  ["invalid guild_id", { guild_id: "bad", user_id: "456" }],
  ["invalid user_id", { guild_id: "123", user_id: "bad" }],
])("validates input strictly: %s", async (_, args) => {
  const registry = new PToolRegistry();
  registry.register(deleteGuildMember);
  const { client, makeRequest } = await harness({
    registry,
    policy: new PPolicyEngine([], ["members"], false),
  });
  const result = await client.callTool({
    name: "discord_delete_guild_member",
    arguments: args,
  });
  expect(errorOf(result)).toMatchObject({ category: "validation" });
  expect(makeRequest).not.toHaveBeenCalled();
});

it("handles 403 missing permissions error", async () => {
  const registry = new PToolRegistry();
  registry.register(deleteGuildMember);
  const { client } = await harness({
    registry,
    policy: new PPolicyEngine([], ["members"], false),
    makeRequest: async () => json({ message: "Missing Permissions", code: 50013 }, { status: 403 }),
  });
  const result = await client.callTool({
    name: "discord_delete_guild_member",
    arguments: {
      guild_id: "123",
      user_id: "456",
    },
  });
  expect(errorOf(result)).toMatchObject({
    category: "permission",
    status: 403,
    discord_code: 50013,
    remediation: "Check the bot permissions; this tool needs KickMembers",
  });
});

it("handles 404 error", async () => {
  const registry = new PToolRegistry();
  registry.register(deleteGuildMember);
  const { client } = await harness({
    registry,
    policy: new PPolicyEngine([], ["members"], false),
    makeRequest: async () => json({ message: "Unknown Member", code: 10007 }, { status: 404 }),
  });
  const result = await client.callTool({
    name: "discord_delete_guild_member",
    arguments: {
      guild_id: "123",
      user_id: "456",
    },
  });
  expect(errorOf(result)).toMatchObject({
    category: "not_found",
    status: 404,
    discord_code: 10007,
    remediation: "Check the IDs in the request",
  });
});
