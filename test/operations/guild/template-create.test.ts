import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { PPolicyEngine } from "../../../src/core/policy.js";
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
  code: "newtemplate123",
  name: "New Template",
  description: "Brand new template",
  usage_count: 0,
  creator_id: "999",
  source_guild_id: "123",
};

it("creates a guild template", async () => {
  const { client, request } = await harness({
    policy,
    respond: () => TEMPLATE,
  });
  const result = await client.callTool({
    name: "discord_create_guild_template",
    arguments: {
      guild_id: "123",
      name: "New Template",
      description: "Brand new template",
    },
  });
  expect(result.structuredContent).toEqual({ template: TEMPLATE });
  const { url, method, body } = request();
  expect([method, url]).toEqual(["POST", "https://discord.com/api/v10/guilds/123/templates"]);
  expect(JSON.parse(String(body))).toEqual({
    name: "New Template",
    description: "Brand new template",
  });
});

it("rejects empty name", async () => {
  const { client, makeRequest } = await harness({ policy });
  const result = await client.callTool({
    name: "discord_create_guild_template",
    arguments: {
      guild_id: "123",
      name: "",
    },
  });
  expect(errorOf(result)).toMatchObject({ category: "validation" });
  expect(makeRequest).not.toHaveBeenCalled();
});

it("allows guilds in the allowlist", async () => {
  const { client } = await harness({
    policy: new PPolicyEngine(["123"], ["core", "guild"], false),
    respond: () => TEMPLATE,
  });
  const result = await client.callTool({
    name: "discord_create_guild_template",
    arguments: { guild_id: "123", name: "New Template" },
  });
  expect(result.structuredContent).toEqual({ template: TEMPLATE });
});

it("blocks guilds outside the allowlist", async () => {
  const { client, makeRequest } = await harness({
    policy: new PPolicyEngine(["999"], ["core", "guild"], false),
  });
  const result = await client.callTool({
    name: "discord_create_guild_template",
    arguments: { guild_id: "123", name: "New Template" },
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
    makeRequest: async () => json({ message: "Missing Permissions", code: 50013 }, { status: 403 }),
  });
  const result = await client.callTool({
    name: "discord_create_guild_template",
    arguments: { guild_id: "123", name: "New Template" },
  });
  expect(errorOf(result)).toMatchObject({
    category: "permission",
    status: 403,
  });
});
