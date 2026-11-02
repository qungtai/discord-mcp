import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { PPolicyEngine } from "../../../src/core/policy.js";
import { defineTool, PToolRegistry } from "../../../src/core/tool-registry.js";
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

it("refuses sync without approval support", async () => {
  const { client, makeRequest } = await harness({ policy });
  const result = await client.callTool({
    name: "discord_sync_guild_template",
    arguments: {
      guild_id: "123",
      code: "sync123",
    },
  });
  expect(errorOf(result)).toMatchObject({
    category: "policy",
    message: "This tool requires approval support",
    remediation: "Wait for the approval flow",
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

function unapprovedRegistry() {
  const reg = new PToolRegistry();
  reg.register({
    ...syncGuildTemplate,
    approval: false,
  });
  return reg;
}

it("syncs a guild template when approval is satisfied", async () => {
  const { client, request } = await harness({
    policy,
    registry: unapprovedRegistry(),
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

it("allows guilds in the allowlist", async () => {
  const { client } = await harness({
    policy: new PPolicyEngine(["123"], ["core", "guild"], false),
    registry: unapprovedRegistry(),
    respond: () => TEMPLATE,
  });
  const result = await client.callTool({
    name: "discord_sync_guild_template",
    arguments: { guild_id: "123", code: "sync123" },
  });
  expect(result.structuredContent).toEqual({ template: TEMPLATE });
});

it("blocks guilds outside the allowlist", async () => {
  const { client, makeRequest } = await harness({
    policy: new PPolicyEngine(["999"], ["core", "guild"], false),
    registry: unapprovedRegistry(),
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

it("maps 403 to permission error", async () => {
  const { client } = await harness({
    policy,
    registry: unapprovedRegistry(),
    makeRequest: async () => json({ message: "Missing Permissions", code: 50013 }, { status: 403 }),
  });
  const result = await client.callTool({
    name: "discord_sync_guild_template",
    arguments: { guild_id: "123", code: "sync123" },
  });
  expect(errorOf(result)).toMatchObject({
    category: "permission",
    status: 403,
  });
});
