import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { PPolicyEngine } from "../../../src/core/policy.js";
import { PToolRegistry } from "../../../src/core/tool-registry.js";
import { syncGuildTemplate } from "../../../src/operations/guild/template-sync.js";
import { errorOf, harness, json } from "../../support/harness.js";

beforeEach(() => {
  vi.spyOn(process.stderr, "write").mockReturnValue(true);
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const policy = new PPolicyEngine([], ["core", "guild"], false);

const TEMPLATE = {
  code: "sync123",
  name: "Synced Template",
  description: "Updated description",
  usage_count: 10,
  creator_id: "999",
  source_guild_id: "123",
};

it("refuses to run when the client cannot ask for approval", async () => {
  const { client, makeRequest } = await harness({ clientCapabilities: {}, policy });
  const result = await client.callTool({
    name: "discord_sync_guild_template",
    arguments: {
      guild_id: "123",
      code: "sync123",
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

it("rejects empty code", async () => {
  const { client, makeRequest } = await harness({ policy });
  const result = await client.callTool({
    name: "discord_sync_guild_template",
    arguments: {
      guild_id: "123",
      code: "",
    },
  });
  expect(errorOf(result)).toMatchObject({ category: "validation" });
  expect(makeRequest).not.toHaveBeenCalled();
});

function toolRegistry() {
  const reg = new PToolRegistry();
  reg.register(syncGuildTemplate);
  return reg;
}

it("syncs a guild template after the client accepts approval", async () => {
  const { client, request } = await harness({
    policy,
    registry: toolRegistry(),
    respond: () => TEMPLATE,
  });
  const result = await client.callTool({
    name: "discord_sync_guild_template",
    arguments: {
      guild_id: "123",
      code: "sync123",
    },
  });
  expect(result.structuredContent).toEqual({ template: TEMPLATE });
  const { url, method } = request();
  expect([method, url]).toEqual([
    "PUT",
    "https://discord.com/api/v10/guilds/123/templates/sync123",
  ]);
});

it("allows guilds in the allowlist and sends expected request", async () => {
  const { client, request } = await harness({
    policy: new PPolicyEngine(["123"], ["core", "guild"], false),
    registry: toolRegistry(),
    respond: () => TEMPLATE,
  });
  const result = await client.callTool({
    name: "discord_sync_guild_template",
    arguments: { guild_id: "123", code: "sync123" },
  });
  expect(result.structuredContent).toEqual({ template: TEMPLATE });
  const { url, method } = request();
  expect([method, url]).toEqual([
    "PUT",
    "https://discord.com/api/v10/guilds/123/templates/sync123",
  ]);
});

it("blocks guilds outside the allowlist", async () => {
  const { client, makeRequest } = await harness({
    policy: new PPolicyEngine(["999"], ["core", "guild"], false),
    registry: toolRegistry(),
  });
  const result = await client.callTool({
    name: "discord_sync_guild_template",
    arguments: { guild_id: "123", code: "sync123" },
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
    name: "discord_sync_guild_template",
    arguments: { guild_id: "123", code: "sync123" },
  });
  expect(errorOf(result)).toMatchObject({
    category: "permission",
    status: 403,
    discord_code: 50013,
    retryable: false,
    message: "Discord rejected the request (HTTP 403): Missing Permissions",
    remediation: "Check the bot permissions; this tool needs ManageGuild",
  });
});

it("maps 404 to not_found error with exact message and remediation", async () => {
  const { client } = await harness({
    policy,
    registry: toolRegistry(),
    makeRequest: async () => json({ message: "Unknown Template", code: 10057 }, { status: 404 }),
  });
  const result = await client.callTool({
    name: "discord_sync_guild_template",
    arguments: { guild_id: "123", code: "sync123" },
  });
  expect(errorOf(result)).toMatchObject({
    category: "not_found",
    status: 404,
    discord_code: 10057,
    retryable: false,
    message: "Discord rejected the request (HTTP 404): Unknown Template",
    remediation: "Check the IDs in the request",
  });
});
