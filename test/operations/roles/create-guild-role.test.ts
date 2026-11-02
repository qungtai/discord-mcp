import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { PPolicyEngine } from "../../../src/core/policy.js";
import { acceptElicitation, errorOf, harness, json } from "../../support/harness.js";

beforeEach(() => {
  vi.spyOn(process.stderr, "write").mockReturnValue(true);
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const policy = new PPolicyEngine([], ["core", "roles"], false);

const CREATED_ROLE = {
  id: "789",
  name: "VIP",
  color: 16711680,
  position: 3,
  permissions: "8",
  managed: false,
  hoist: true,
  mentionable: true,
  icon: "vip_icon",
  unicode_emoji: "⭐",
  flags: 0,
  colors: { primary_color: 16711680, secondary_color: null, tertiary_color: null },
  tags: {},
};

it("refuses to create a role when the client cannot ask for approval", async () => {
  const { client, makeRequest } = await harness({ policy, clientCapabilities: {} });
  const result = await client.callTool({
    name: "discord_create_guild_role",
    arguments: { guild_id: "123", name: "Admin", permissions: "8" },
  });
  expect(errorOf(result)).toMatchObject({
    category: "policy",
    message: "This tool needs approval but the client does not support elicitation",
    remediation:
      "Use an MCP client that supports elicitation, or set DISCORD_MCP_APPROVAL=none to rely on the client's own tool approval",
  });
  expect(makeRequest).not.toHaveBeenCalled();
});

it("creates a guild role with optional fields and reason after the client accepts approval", async () => {
  const onElicit = vi.fn(acceptElicitation);
  const { client, request } = await harness({
    policy,
    onElicit,
    respond: () => CREATED_ROLE,
  });
  const result = await client.callTool({
    name: "discord_create_guild_role",
    arguments: {
      guild_id: "123",
      name: "VIP",
      permissions: "8",
      color: 16711680,
      colors: { primary_color: 16711680 },
      hoist: true,
      mentionable: true,
      unicode_emoji: "⭐",
      reason: "special members",
    },
  });
  expect(onElicit).toHaveBeenCalledTimes(1);
  expect(result.structuredContent).toEqual({ role: CREATED_ROLE });
  const { url, method, body, headers } = request();
  expect([method, url]).toEqual(["POST", "https://discord.com/api/v10/guilds/123/roles"]);
  expect(headers).toMatchObject({ "X-Audit-Log-Reason": "special%20members" });
  expect(JSON.parse(String(body))).toEqual({
    name: "VIP",
    permissions: "8",
    color: 16711680,
    colors: { primary_color: 16711680 },
    hoist: true,
    mentionable: true,
    unicode_emoji: "⭐",
  });
});

it("rejects misspelled nested properties in colors", async () => {
  const { client, makeRequest } = await harness({ policy });
  const result = await client.callTool({
    name: "discord_create_guild_role",
    arguments: {
      guild_id: "123",
      colors: { primary_colo: 123 },
    },
  });
  expect(errorOf(result)).toMatchObject({ category: "validation" });
  expect(makeRequest).not.toHaveBeenCalled();
});

it("allows guilds in the allowlist and sends expected request", async () => {
  const { client, request } = await harness({
    policy: new PPolicyEngine(["123"], ["core", "roles"], false),
    respond: () => CREATED_ROLE,
  });
  const result = await client.callTool({
    name: "discord_create_guild_role",
    arguments: { guild_id: "123", name: "VIP" },
  });
  expect(result.structuredContent).toEqual({ role: CREATED_ROLE });
  const { url, method, body } = request();
  expect([method, url]).toEqual(["POST", "https://discord.com/api/v10/guilds/123/roles"]);
  expect(JSON.parse(String(body))).toEqual({ name: "VIP" });
});

it("blocks guilds outside the allowlist", async () => {
  const { client, makeRequest } = await harness({
    policy: new PPolicyEngine(["999"], ["core", "roles"], false),
  });
  const result = await client.callTool({
    name: "discord_create_guild_role",
    arguments: { guild_id: "123", name: "VIP" },
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
    makeRequest: async () => json({ message: "Missing Permissions", code: 50013 }, { status: 403 }),
  });
  const result = await client.callTool({
    name: "discord_create_guild_role",
    arguments: { guild_id: "123", name: "VIP" },
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
    makeRequest: async () => json({ message: "Unknown Guild", code: 10004 }, { status: 404 }),
  });
  const result = await client.callTool({
    name: "discord_create_guild_role",
    arguments: { guild_id: "123", name: "VIP" },
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
