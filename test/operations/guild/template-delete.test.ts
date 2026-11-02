import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { PPolicyEngine } from "../../../src/core/policy.js";
import { defineTool, PToolRegistry } from "../../../src/core/tool-registry.js";
import { deleteGuildTemplate } from "../../../src/operations/guild/template-delete.js";
import { errorOf, harness, json } from "../../support/harness.js";

beforeEach(() => {
  vi.spyOn(process.stderr, "write").mockReturnValue(true);
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const policy = new PPolicyEngine([], ["core", "guild"], false);

const DELETED_TEMPLATE = {
  code: "del123",
  name: "Deleted Template",
  description: "To be deleted",
  usage_count: 0,
  creator_id: "999",
  source_guild_id: "123",
};

it("refuses delete without approval support", async () => {
  const { client, makeRequest } = await harness({ policy });
  const result = await client.callTool({
    name: "discord_delete_guild_template",
    arguments: {
      guild_id: "123",
      code: "del123",
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
    name: "discord_delete_guild_template",
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
    ...deleteGuildTemplate,
    approval: false,
  });
  return reg;
}

it("deletes a guild template when approval is satisfied", async () => {
  const { client, request } = await harness({
    policy,
    registry: unapprovedRegistry(),
    respond: () => DELETED_TEMPLATE,
  });
  const result = await client.callTool({
    name: "discord_delete_guild_template",
    arguments: {
      guild_id: "123",
      code: "del123",
    },
  });
  expect(result.structuredContent).toEqual({ template: DELETED_TEMPLATE });
  const { url, method } = request();
  expect([method, url]).toEqual([
    "DELETE",
    "https://discord.com/api/v10/guilds/123/templates/del123",
  ]);
});

it("allows guilds in the allowlist", async () => {
  const { client } = await harness({
    policy: new PPolicyEngine(["123"], ["core", "guild"], false),
    registry: unapprovedRegistry(),
    respond: () => DELETED_TEMPLATE,
  });
  const result = await client.callTool({
    name: "discord_delete_guild_template",
    arguments: { guild_id: "123", code: "del123" },
  });
  expect(result.structuredContent).toEqual({ template: DELETED_TEMPLATE });
});

it("blocks guilds outside the allowlist", async () => {
  const { client, makeRequest } = await harness({
    policy: new PPolicyEngine(["999"], ["core", "guild"], false),
    registry: unapprovedRegistry(),
  });
  const result = await client.callTool({
    name: "discord_delete_guild_template",
    arguments: { guild_id: "123", code: "del123" },
  });
  expect(errorOf(result)).toMatchObject({
    category: "policy",
    message: "Guild is not allowed",
  });
  expect(makeRequest).not.toHaveBeenCalled();
});

it("maps 404 to not_found error", async () => {
  const { client } = await harness({
    policy,
    registry: unapprovedRegistry(),
    makeRequest: async () => json({ message: "Unknown Template", code: 10057 }, { status: 404 }),
  });
  const result = await client.callTool({
    name: "discord_delete_guild_template",
    arguments: { guild_id: "123", code: "del123" },
  });
  expect(errorOf(result)).toMatchObject({
    category: "not_found",
    status: 404,
  });
});
