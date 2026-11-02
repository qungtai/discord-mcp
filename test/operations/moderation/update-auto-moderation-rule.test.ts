import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { PPolicyEngine } from "../../../src/core/policy.js";
import { PToolRegistry } from "../../../src/core/tool-registry.js";
import { updateAutoModerationRule } from "../../../src/operations/moderation/update-auto-moderation-rule.js";
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
  reg.register({
    ...updateAutoModerationRule,
    approval: false,
  });
  return reg;
}

const RULE = {
  id: "201",
  guild_id: "123",
  name: "Updated Keyword Block",
  creator_id: "999",
  event_type: 1,
  trigger_type: 1,
  trigger_metadata: { keyword_filter: ["badword", "anotherbad"] },
  actions: [{ type: 1, metadata: { custom_message: "Not allowed" } }],
  enabled: false,
  exempt_roles: ["301"],
  exempt_channels: ["401"],
};

it("modifies an auto moderation rule for a guild with reason header", async () => {
  const { client, request } = await harness({
    registry: optedOutRegistry(),
    policy: new PPolicyEngine([], ["core", "moderation"], false),
    respond: () => RULE,
  });
  const result = await client.callTool({
    name: "discord_update_auto_moderation_rule",
    arguments: {
      guild_id: "123",
      rule_id: "201",
      name: "Updated Keyword Block",
      enabled: false,
      reason: "update keyword filter",
    },
  });
  expect(result.structuredContent).toEqual({ rule: RULE });
  const req = request();
  expect(req.url).toBe("https://discord.com/api/v10/guilds/123/auto-moderation/rules/201");
  expect(req.method).toBe("PATCH");
  expect(JSON.parse(String(req.body))).toEqual({
    name: "Updated Keyword Block",
    enabled: false,
  });
  expect(req.headers).toMatchObject({ "X-Audit-Log-Reason": "update%20keyword%20filter" });
});

it("rejects invalid input", async () => {
  const { client, makeRequest } = await harness({
    registry: optedOutRegistry(),
    policy: new PPolicyEngine([], ["core", "moderation"], false),
  });
  const result = await client.callTool({
    name: "discord_update_auto_moderation_rule",
    arguments: { guild_id: "123", rule_id: "201", name: "" },
  });
  expect(errorOf(result)).toMatchObject({ category: "validation" });
  expect(makeRequest).not.toHaveBeenCalled();
});

it("maps 403 to permission error with ManageGuild remediation", async () => {
  const { client } = await harness({
    registry: optedOutRegistry(),
    policy: new PPolicyEngine([], ["core", "moderation"], false),
    makeRequest: async () => json({ message: "Missing Permissions", code: 50013 }, { status: 403 }),
  });
  const result = await client.callTool({
    name: "discord_update_auto_moderation_rule",
    arguments: { guild_id: "123", rule_id: "201", enabled: true },
  });
  expect(errorOf(result)).toMatchObject({
    category: "permission",
    status: 403,
    remediation: "Check the bot permissions; this tool needs ManageGuild",
  });
});

it("maps 404 to not_found error", async () => {
  const { client } = await harness({
    registry: optedOutRegistry(),
    policy: new PPolicyEngine([], ["core", "moderation"], false),
    makeRequest: async () => json({ message: "Unknown Rule", code: 10004 }, { status: 404 }),
  });
  const result = await client.callTool({
    name: "discord_update_auto_moderation_rule",
    arguments: { guild_id: "123", rule_id: "201", enabled: true },
  });
  expect(errorOf(result)).toMatchObject({
    category: "not_found",
    status: 404,
  });
});

it("allows execution when guild is in allowlist", async () => {
  const { client, request } = await harness({
    registry: optedOutRegistry(),
    policy: new PPolicyEngine(["123"], ["core", "moderation"], false),
    respond: () => RULE,
  });
  const result = await client.callTool({
    name: "discord_update_auto_moderation_rule",
    arguments: { guild_id: "123", rule_id: "201", enabled: false },
  });
  expect(result.structuredContent).toEqual({ rule: RULE });
  expect(request().method).toBe("PATCH");
});

it("denies execution when guild is not in allowlist", async () => {
  const { client, makeRequest } = await harness({
    registry: optedOutRegistry(),
    policy: new PPolicyEngine(["999"], ["core", "moderation"], false),
  });
  const result = await client.callTool({
    name: "discord_update_auto_moderation_rule",
    arguments: { guild_id: "123", rule_id: "201", enabled: false },
  });
  expect(errorOf(result)).toMatchObject({
    category: "policy",
    message: "Guild is not allowed",
  });
  expect(makeRequest).not.toHaveBeenCalled();
});

it("denies execution under default approval policy", async () => {
  const { client, makeRequest } = await harness({
    policy: new PPolicyEngine([], ["core", "moderation"], false),
  });
  const result = await client.callTool({
    name: "discord_update_auto_moderation_rule",
    arguments: { guild_id: "123", rule_id: "201", enabled: false },
  });
  expect(errorOf(result)).toMatchObject({
    category: "policy",
    message: "This tool requires approval support",
    remediation: "Wait for the approval flow",
  });
  expect(makeRequest).not.toHaveBeenCalled();
});
