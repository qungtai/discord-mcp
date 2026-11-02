import type { ResponseLike } from "@discordjs/rest";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { PPolicyEngine } from "../../../src/core/policy.js";
import { PToolRegistry } from "../../../src/core/tool-registry.js";
import { deleteAutoModerationRule } from "../../../src/operations/moderation/delete-auto-moderation-rule.js";
import { errorOf, harness, json } from "../../support/harness.js";

beforeEach(() => {
  vi.spyOn(process.stderr, "write").mockReturnValue(true);
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function optedOutRegistry() {
  const reg = new PToolRegistry();
  reg.register(deleteAutoModerationRule);
  return reg;
}

const mock204 = async () => new Response(null, { status: 204 }) as unknown as ResponseLike;

it("deletes an auto moderation rule for a guild with reason header (exercising HTTP 204)", async () => {
  const { client, request } = await harness({
    registry: optedOutRegistry(),
    policy: new PPolicyEngine([], ["core", "moderation"], false),
    makeRequest: mock204,
  });
  const result = await client.callTool({
    name: "discord_delete_auto_moderation_rule",
    arguments: {
      guild_id: "123",
      rule_id: "201",
      reason: "deprecated rule",
    },
  });
  expect(result.structuredContent).toEqual({
    deleted: true,
    guild_id: "123",
    rule_id: "201",
  });
  const req = request();
  expect(req.url).toBe("https://discord.com/api/v10/guilds/123/auto-moderation/rules/201");
  expect(req.method).toBe("DELETE");
  expect(req.headers).toMatchObject({ "X-Audit-Log-Reason": "deprecated%20rule" });
});

it.each([
  [{ guild_id: "invalid", rule_id: "201" }],
  [{ guild_id: "123", rule_id: "not-a-snowflake" }],
  [{ guild_id: "123" }],
])("rejects invalid input: %j", async (args) => {
  const { client, makeRequest } = await harness({
    registry: optedOutRegistry(),
    policy: new PPolicyEngine([], ["core", "moderation"], false),
  });
  const result = await client.callTool({
    name: "discord_delete_auto_moderation_rule",
    arguments: args,
  });
  expect(errorOf(result)).toMatchObject({
    category: "validation",
    message: expect.stringContaining("Invalid input"),
  });
  expect(makeRequest).not.toHaveBeenCalled();
});

it("maps 403 to permission error with ManageGuild remediation and literal message", async () => {
  const { client } = await harness({
    registry: optedOutRegistry(),
    policy: new PPolicyEngine([], ["core", "moderation"], false),
    makeRequest: async () => json({ message: "Missing Permissions", code: 50013 }, { status: 403 }),
  });
  const result = await client.callTool({
    name: "discord_delete_auto_moderation_rule",
    arguments: { guild_id: "123", rule_id: "201" },
  });
  expect(errorOf(result)).toMatchObject({
    category: "permission",
    status: 403,
    message: "Discord rejected the request (HTTP 403): Missing Permissions",
    remediation: "Check the bot permissions; this tool needs ManageGuild",
  });
});

it("maps 404 to not_found error with literal message", async () => {
  const { client } = await harness({
    registry: optedOutRegistry(),
    policy: new PPolicyEngine([], ["core", "moderation"], false),
    makeRequest: async () => json({ message: "Unknown Rule", code: 10004 }, { status: 404 }),
  });
  const result = await client.callTool({
    name: "discord_delete_auto_moderation_rule",
    arguments: { guild_id: "123", rule_id: "201" },
  });
  expect(errorOf(result)).toMatchObject({
    category: "not_found",
    status: 404,
    message: "Discord rejected the request (HTTP 404): Unknown Rule",
  });
});

it("allows execution when guild is in allowlist (exercising HTTP 204)", async () => {
  const { client, request } = await harness({
    registry: optedOutRegistry(),
    policy: new PPolicyEngine(["123"], ["core", "moderation"], false),
    makeRequest: mock204,
  });
  const result = await client.callTool({
    name: "discord_delete_auto_moderation_rule",
    arguments: { guild_id: "123", rule_id: "201" },
  });
  expect(result.structuredContent).toEqual({
    deleted: true,
    guild_id: "123",
    rule_id: "201",
  });
  expect(request().method).toBe("DELETE");
});

it("denies execution when guild is not in allowlist", async () => {
  const { client, makeRequest } = await harness({
    registry: optedOutRegistry(),
    policy: new PPolicyEngine(["999"], ["core", "moderation"], false),
  });
  const result = await client.callTool({
    name: "discord_delete_auto_moderation_rule",
    arguments: { guild_id: "123", rule_id: "201" },
  });
  expect(errorOf(result)).toMatchObject({
    category: "policy",
    message: "Guild is not allowed",
  });
  expect(makeRequest).not.toHaveBeenCalled();
});

it("refuses to run when the client cannot ask for approval", async () => {
  const { client, makeRequest } = await harness({
    clientCapabilities: {},
    policy: new PPolicyEngine([], ["core", "moderation"], false),
  });
  const result = await client.callTool({
    name: "discord_delete_auto_moderation_rule",
    arguments: { guild_id: "123", rule_id: "201" },
  });
  expect(errorOf(result)).toMatchObject({
    category: "policy",
    message: "This tool needs approval but the client does not support elicitation",
    remediation:
      "Use an MCP client that supports elicitation, or set DISCORD_MCP_APPROVAL=none to rely on the client's own tool approval",
  });
  expect(makeRequest).not.toHaveBeenCalled();
});
