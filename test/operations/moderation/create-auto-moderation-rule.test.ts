import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { PPolicyEngine } from "../../../src/core/policy.js";
import { PToolRegistry } from "../../../src/core/tool-registry.js";
import { createAutoModerationRule } from "../../../src/operations/moderation/create-auto-moderation-rule.js";
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
  reg.register(createAutoModerationRule);
  return reg;
}

const RULE = {
  id: "201",
  guild_id: "123",
  name: "Keyword Block",
  creator_id: "999",
  event_type: 1,
  trigger_type: 1,
  trigger_metadata: {
    keyword_filter: ["badword"],
    regex_patterns: ["bad.*"],
    presets: [1, 2],
    allow_list: ["goodword"],
    mention_total_limit: 10,
    mention_raid_protection_enabled: true,
  },
  actions: [
    { type: 1, metadata: { custom_message: "Not allowed" } },
    { type: 2, metadata: { channel_id: "401" } },
    { type: 3, metadata: { duration_seconds: 60 } },
  ],
  enabled: true,
  exempt_roles: ["301"],
  exempt_channels: ["401"],
};

it("creates an auto moderation rule for a guild with reason header", async () => {
  const { client, request } = await harness({
    registry: optedOutRegistry(),
    policy: new PPolicyEngine([], ["core", "moderation"], false),
    respond: () => RULE,
  });
  const result = await client.callTool({
    name: "discord_create_auto_moderation_rule",
    arguments: {
      guild_id: "123",
      name: "Keyword Block",
      event_type: 1,
      trigger_type: 1,
      trigger_metadata: {
        keyword_filter: ["badword"],
        regex_patterns: ["bad.*"],
        presets: [1, 2],
        allow_list: ["goodword"],
        mention_total_limit: 10,
        mention_raid_protection_enabled: true,
      },
      actions: [
        { type: 1, metadata: { custom_message: "Not allowed" } },
        { type: 2, metadata: { channel_id: "401" } },
        { type: 3, metadata: { duration_seconds: 60 } },
      ],
      enabled: true,
      exempt_roles: ["301"],
      exempt_channels: ["401"],
      reason: "security rule",
    },
  });
  expect(result.structuredContent).toEqual({ rule: RULE });
  const req = request();
  expect(req.url).toBe("https://discord.com/api/v10/guilds/123/auto-moderation/rules");
  expect(req.method).toBe("POST");
  expect(JSON.parse(String(req.body))).toEqual({
    name: "Keyword Block",
    event_type: 1,
    trigger_type: 1,
    trigger_metadata: {
      keyword_filter: ["badword"],
      regex_patterns: ["bad.*"],
      presets: [1, 2],
      allow_list: ["goodword"],
      mention_total_limit: 10,
      mention_raid_protection_enabled: true,
    },
    actions: [
      { type: 1, metadata: { custom_message: "Not allowed" } },
      { type: 2, metadata: { channel_id: "401" } },
      { type: 3, metadata: { duration_seconds: 60 } },
    ],
    enabled: true,
    exempt_roles: ["301"],
    exempt_channels: ["401"],
  });
  expect(req.headers).toMatchObject({ "X-Audit-Log-Reason": "security%20rule" });
});

const validBase = {
  guild_id: "123",
  name: "Keyword Block",
  event_type: 1,
  trigger_type: 1,
  actions: [{ type: 1 }],
};

it.each([
  [{ ...validBase, name: "" }],
  [{ ...validBase, name: "a".repeat(101) }],
  [{ ...validBase, event_type: 99 }],
  [{ ...validBase, trigger_type: 99 }],
  [{ ...validBase, actions: [] }],
  [{ ...validBase, actions: Array.from({ length: 6 }, () => ({ type: 1 })) }],
  [{ ...validBase, actions: [{ type: 99 }] }],
  [{ ...validBase, actions: [{ type: 1, metadata: { foo: "unknown" } }] }],
  [{ ...validBase, actions: [{ type: 1, metadata: { custom_message: "a".repeat(301) } }] }],
  [{ ...validBase, actions: [{ type: 3, metadata: { duration_seconds: -1 } }] }],
  [{ ...validBase, actions: [{ type: 3, metadata: { duration_seconds: 2419201 } }] }],
  [{ ...validBase, actions: [{ type: 2, metadata: { channel_id: "invalid" } }] }],
  [{ ...validBase, trigger_metadata: { unknown_prop: 1 } }],
  [{ ...validBase, trigger_metadata: { keyword_filter: [""] } }],
  [{ ...validBase, trigger_metadata: { keyword_filter: ["a".repeat(61)] } }],
  [{ ...validBase, trigger_metadata: { regex_patterns: ["a".repeat(261)] } }],
  [{ ...validBase, trigger_metadata: { presets: [99] } }],
  [{ ...validBase, trigger_metadata: { mention_total_limit: -1 } }],
  [{ ...validBase, trigger_metadata: { mention_total_limit: 51 } }],
  [{ ...validBase, exempt_roles: Array.from({ length: 21 }, (_, i) => String(i + 1)) }],
  [{ ...validBase, exempt_channels: Array.from({ length: 51 }, (_, i) => String(i + 1)) }],
])("rejects invalid input: %j", async (args) => {
  const { client, makeRequest } = await harness({
    registry: optedOutRegistry(),
    policy: new PPolicyEngine([], ["core", "moderation"], false),
  });
  const result = await client.callTool({
    name: "discord_create_auto_moderation_rule",
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
    name: "discord_create_auto_moderation_rule",
    arguments: validBase,
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
    makeRequest: async () => json({ message: "Unknown Guild", code: 10004 }, { status: 404 }),
  });
  const result = await client.callTool({
    name: "discord_create_auto_moderation_rule",
    arguments: validBase,
  });
  expect(errorOf(result)).toMatchObject({
    category: "not_found",
    status: 404,
    message: "Discord rejected the request (HTTP 404): Unknown Guild",
  });
});

it("allows execution when guild is in allowlist", async () => {
  const { client, request } = await harness({
    registry: optedOutRegistry(),
    policy: new PPolicyEngine(["123"], ["core", "moderation"], false),
    respond: () => RULE,
  });
  const result = await client.callTool({
    name: "discord_create_auto_moderation_rule",
    arguments: validBase,
  });
  expect(result.structuredContent).toEqual({ rule: RULE });
  expect(request().method).toBe("POST");
});

it("denies execution when guild is not in allowlist", async () => {
  const { client, makeRequest } = await harness({
    registry: optedOutRegistry(),
    policy: new PPolicyEngine(["999"], ["core", "moderation"], false),
  });
  const result = await client.callTool({
    name: "discord_create_auto_moderation_rule",
    arguments: validBase,
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
    name: "discord_create_auto_moderation_rule",
    arguments: validBase,
  });
  expect(errorOf(result)).toMatchObject({
    category: "policy",
    message: "This tool needs approval but the client does not support elicitation",
    remediation:
      "Use an MCP client that supports elicitation, or set DISCORD_MCP_APPROVAL=none to rely on the client's own tool approval",
  });
  expect(makeRequest).not.toHaveBeenCalled();
});
