import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { PPolicyEngine } from "../../../src/core/policy.js";
import { PToolRegistry } from "../../../src/core/tool-registry.js";
import { updateGuildTemplate } from "../../../src/operations/guild/template-update.js";
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
  code: "update123",
  name: "Updated Name",
  description: "Updated description",
  usage_count: 3,
  creator_id: "999",
  source_guild_id: "123",
};

it("refuses update without approval support", async () => {
  const { client, makeRequest } = await harness({ policy });
  const result = await client.callTool({
    name: "discord_update_guild_template",
    arguments: {
      guild_id: "123",
      code: "update123",
      name: "Updated Name",
    },
  });
  expect(errorOf(result)).toMatchObject({
    category: "policy",
    message: "This tool requires approval support",
    remediation: "Wait for the approval flow",
  });
  expect(makeRequest).not.toHaveBeenCalled();
});

it("rejects invalid guild_id", async () => {
  const { client, makeRequest } = await harness({ policy });
  const result = await client.callTool({
    name: "discord_update_guild_template",
    arguments: {
      guild_id: "invalid",
      code: "update123",
    },
  });
  expect(errorOf(result)).toMatchObject({ category: "validation" });
  expect(makeRequest).not.toHaveBeenCalled();
});

function unapprovedRegistry() {
  const reg = new PToolRegistry();
  reg.register({
    ...updateGuildTemplate,
    approval: false,
  });
  return reg;
}

it("updates a guild template when approval is satisfied", async () => {
  const { client, request } = await harness({
    policy,
    registry: unapprovedRegistry(),
    respond: () => TEMPLATE,
  });
  const result = await client.callTool({
    name: "discord_update_guild_template",
    arguments: {
      guild_id: "123",
      code: "update123",
      name: "Updated Name",
      description: "Updated description",
    },
  });
  expect(result.structuredContent).toEqual({ template: TEMPLATE });
  const { url, method, body } = request();
  expect([method, url]).toEqual([
    "PATCH",
    "https://discord.com/api/v10/guilds/123/templates/update123",
  ]);
  expect(JSON.parse(String(body))).toEqual({
    name: "Updated Name",
    description: "Updated description",
  });
});

it("allows guilds in the allowlist and sends expected request", async () => {
  const { client, request } = await harness({
    policy: new PPolicyEngine(["123"], ["core", "guild"], false),
    registry: unapprovedRegistry(),
    respond: () => TEMPLATE,
  });
  const result = await client.callTool({
    name: "discord_update_guild_template",
    arguments: { guild_id: "123", code: "update123", name: "Updated Name" },
  });
  expect(result.structuredContent).toEqual({ template: TEMPLATE });
  const { url, method, body } = request();
  expect([method, url]).toEqual([
    "PATCH",
    "https://discord.com/api/v10/guilds/123/templates/update123",
  ]);
  expect(JSON.parse(String(body))).toEqual({ name: "Updated Name" });
});

it("blocks guilds outside the allowlist", async () => {
  const { client, makeRequest } = await harness({
    policy: new PPolicyEngine(["999"], ["core", "guild"], false),
    registry: unapprovedRegistry(),
  });
  const result = await client.callTool({
    name: "discord_update_guild_template",
    arguments: { guild_id: "123", code: "update123", name: "Updated Name" },
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
    registry: unapprovedRegistry(),
    makeRequest: async () => json({ message: "Missing Permissions", code: 50013 }, { status: 403 }),
  });
  const result = await client.callTool({
    name: "discord_update_guild_template",
    arguments: { guild_id: "123", code: "update123", name: "Updated Name" },
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
    registry: unapprovedRegistry(),
    makeRequest: async () => json({ message: "Unknown Template", code: 10057 }, { status: 404 }),
  });
  const result = await client.callTool({
    name: "discord_update_guild_template",
    arguments: { guild_id: "123", code: "update123", name: "Updated Name" },
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
