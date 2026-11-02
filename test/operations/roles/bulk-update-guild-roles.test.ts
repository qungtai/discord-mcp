import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { PPolicyEngine } from "../../../src/core/policy.js";
import { PToolRegistry } from "../../../src/core/tool-registry.js";
import { bulkUpdateGuildRoles } from "../../../src/operations/roles/bulk-update-guild-roles.js";
import { errorOf, harness, json } from "../../support/harness.js";

beforeEach(() => {
  vi.spyOn(process.stderr, "write").mockReturnValue(true);
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const policy = new PPolicyEngine([], ["core", "roles"], false);

const ROLES = [
  { id: "101", position: 1 },
  { id: "102", position: 2 },
];

it("refuses to run when the client cannot ask for approval", async () => {
  const { client, makeRequest } = await harness({ clientCapabilities: {}, policy });
  const result = await client.callTool({
    name: "discord_bulk_update_guild_roles",
    arguments: {
      guild_id: "123",
      roles: [{ id: "101", position: 1 }],
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

it("rejects invalid roles array structure", async () => {
  const { client, makeRequest } = await harness({ policy });
  const result = await client.callTool({
    name: "discord_bulk_update_guild_roles",
    arguments: {
      guild_id: "123",
      roles: [{ id: "invalid-id", position: 1 }],
    },
  });
  expect(errorOf(result)).toMatchObject({ category: "validation" });
  expect(makeRequest).not.toHaveBeenCalled();
});

function toolRegistry() {
  const reg = new PToolRegistry();
  reg.register(bulkUpdateGuildRoles);
  return reg;
}

it("bulk updates guild role positions with reason after the client accepts approval", async () => {
  const { client, request } = await harness({
    policy,
    registry: toolRegistry(),
    respond: () => ROLES,
  });
  const result = await client.callTool({
    name: "discord_bulk_update_guild_roles",
    arguments: {
      guild_id: "123",
      roles: ROLES,
      reason: "reorder",
    },
  });
  expect(result.structuredContent).toEqual({ roles: ROLES });
  const { url, method, body, headers } = request();
  expect([method, url]).toEqual(["PATCH", "https://discord.com/api/v10/guilds/123/roles"]);
  expect(headers).toMatchObject({ "X-Audit-Log-Reason": "reorder" });
  expect(JSON.parse(String(body))).toEqual(ROLES);
});

it("rejects unknown nested properties in role position objects", async () => {
  const { client, makeRequest } = await harness({
    policy,
    registry: toolRegistry(),
  });
  const result = await client.callTool({
    name: "discord_bulk_update_guild_roles",
    arguments: {
      guild_id: "123",
      roles: [{ id: "101", position: 1, extra: "bad" }],
    },
  });
  expect(errorOf(result)).toMatchObject({ category: "validation" });
  expect(makeRequest).not.toHaveBeenCalled();
});

it("allows guilds in the allowlist and sends expected request", async () => {
  const { client, request } = await harness({
    policy: new PPolicyEngine(["123"], ["core", "roles"], false),
    registry: toolRegistry(),
    respond: () => ROLES,
  });
  const result = await client.callTool({
    name: "discord_bulk_update_guild_roles",
    arguments: { guild_id: "123", roles: ROLES },
  });
  expect(result.structuredContent).toEqual({ roles: ROLES });
  const { url, method, body } = request();
  expect([method, url]).toEqual(["PATCH", "https://discord.com/api/v10/guilds/123/roles"]);
  expect(JSON.parse(String(body))).toEqual(ROLES);
});

it("blocks guilds outside the allowlist", async () => {
  const { client, makeRequest } = await harness({
    policy: new PPolicyEngine(["999"], ["core", "roles"], false),
    registry: toolRegistry(),
  });
  const result = await client.callTool({
    name: "discord_bulk_update_guild_roles",
    arguments: { guild_id: "123", roles: ROLES },
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
    name: "discord_bulk_update_guild_roles",
    arguments: { guild_id: "123", roles: ROLES },
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
    makeRequest: async () => json({ message: "Unknown Guild", code: 10004 }, { status: 404 }),
  });
  const result = await client.callTool({
    name: "discord_bulk_update_guild_roles",
    arguments: { guild_id: "123", roles: ROLES },
  });
  expect(errorOf(result)).toMatchObject({
    category: "not_found",
    status: 404,
    discord_code: 10004,
    retryable: false,
    message: "Discord rejected the request (HTTP 404): Unknown Guild",
    remediation: "Check the IDs in the request",
  });
});
