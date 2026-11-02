import type { ResponseLike } from "@discordjs/rest";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { PPolicyEngine } from "../../../src/core/policy.js";
import { PToolRegistry } from "../../../src/core/tool-registry.js";
import { deleteGuildRole } from "../../../src/operations/roles/delete-guild-role.js";
import { errorOf, harness, json } from "../../support/harness.js";

beforeEach(() => {
  vi.spyOn(process.stderr, "write").mockReturnValue(true);
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const policy = new PPolicyEngine([], ["core", "roles"], false);

it("refuses to run when the client cannot ask for approval", async () => {
  const { client, makeRequest } = await harness({ clientCapabilities: {}, policy });
  const result = await client.callTool({
    name: "discord_delete_guild_role",
    arguments: {
      guild_id: "123",
      role_id: "456",
    },
  });
  expect(errorOf(result)).toMatchObject({
    category: "policy",
    message: "This tool needs approval but the client does not support elicitation",
    remediation:
      "Use an MCP client that supports elicitation, or set DISCORD_MCP_APPROVAL=none to rely on the client's own tool approval",
  });
  expect(makeRequest).not.toHaveBeenCalled();
});

it("rejects invalid role_id", async () => {
  const { client, makeRequest } = await harness({ policy });
  const result = await client.callTool({
    name: "discord_delete_guild_role",
    arguments: {
      guild_id: "123",
      role_id: "invalid",
    },
  });
  expect(errorOf(result)).toMatchObject({ category: "validation" });
  expect(makeRequest).not.toHaveBeenCalled();
});

function toolRegistry() {
  const reg = new PToolRegistry();
  reg.register(deleteGuildRole);
  return reg;
}

it("deletes a guild role with reason after the client accepts approval", async () => {
  const { client, request } = await harness({
    policy,
    registry: toolRegistry(),
    makeRequest: async () => new Response(null, { status: 204 }) as unknown as ResponseLike,
  });
  const result = await client.callTool({
    name: "discord_delete_guild_role",
    arguments: {
      guild_id: "123",
      role_id: "456",
      reason: "cleaning up",
    },
  });
  expect(result.structuredContent).toEqual({
    deleted: true,
    guild_id: "123",
    role_id: "456",
  });
  const { url, method, headers } = request();
  expect([method, url]).toEqual(["DELETE", "https://discord.com/api/v10/guilds/123/roles/456"]);
  expect(headers).toMatchObject({ "X-Audit-Log-Reason": "cleaning%20up" });
});

it("allows guilds in the allowlist and sends expected request", async () => {
  const { client, request } = await harness({
    policy: new PPolicyEngine(["123"], ["core", "roles"], false),
    registry: toolRegistry(),
    makeRequest: async () => new Response(null, { status: 204 }) as unknown as ResponseLike,
  });
  const result = await client.callTool({
    name: "discord_delete_guild_role",
    arguments: { guild_id: "123", role_id: "456" },
  });
  expect(result.structuredContent).toEqual({
    deleted: true,
    guild_id: "123",
    role_id: "456",
  });
  const { url, method } = request();
  expect([method, url]).toEqual(["DELETE", "https://discord.com/api/v10/guilds/123/roles/456"]);
});

it("blocks guilds outside the allowlist", async () => {
  const { client, makeRequest } = await harness({
    policy: new PPolicyEngine(["999"], ["core", "roles"], false),
    registry: toolRegistry(),
  });
  const result = await client.callTool({
    name: "discord_delete_guild_role",
    arguments: { guild_id: "123", role_id: "456" },
  });
  expect(errorOf(result)).toMatchObject({
    category: "policy",
    message: "Guild is not allowed",
  });
  expect(makeRequest).not.toHaveBeenCalled();
});

it("maps 403 to permission error with exact message and remediation", async () => {
  const { client } = await harness({
    policy,
    registry: toolRegistry(),
    makeRequest: async () => json({ message: "Missing Permissions", code: 50013 }, { status: 403 }),
  });
  const result = await client.callTool({
    name: "discord_delete_guild_role",
    arguments: { guild_id: "123", role_id: "456" },
  });
  expect(errorOf(result)).toMatchObject({
    category: "permission",
    status: 403,
    discord_code: 50013,
    retryable: false,
    message: "Discord rejected the request (HTTP 403): Missing Permissions",
    remediation: "Check the bot permissions; this tool needs ManageRoles",
  });
});

it("maps 404 to not_found error with exact message and remediation", async () => {
  const { client } = await harness({
    policy,
    registry: toolRegistry(),
    makeRequest: async () => json({ message: "Unknown Role", code: 10011 }, { status: 404 }),
  });
  const result = await client.callTool({
    name: "discord_delete_guild_role",
    arguments: { guild_id: "123", role_id: "456" },
  });
  expect(errorOf(result)).toMatchObject({
    category: "not_found",
    status: 404,
    discord_code: 10011,
    retryable: false,
    message: "Discord rejected the request (HTTP 404): Unknown Role",
    remediation: "Check the IDs in the request",
  });
});
