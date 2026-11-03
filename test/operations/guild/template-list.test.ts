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
  code: "abc123xyz",
  name: "Guild Template",
  description: "Guild template description",
  usage_count: 5,
  creator_id: "999",
  source_guild_id: "123",
};

it("lists templates for a guild", async () => {
  const { client, request } = await harness({
    policy,
    respond: () => [TEMPLATE],
  });
  const result = await client.callTool({
    name: "discord_list_guild_templates",
    arguments: { guild_id: "123" },
  });
  expect(result.structuredContent).toEqual({ templates: [TEMPLATE] });
  const { url, method } = request();
  expect([method, url]).toEqual(["GET", "https://discord.com/api/v10/guilds/123/templates"]);
});

it("rejects invalid guild_id", async () => {
  const { client, makeRequest } = await harness({ policy });
  const result = await client.callTool({
    name: "discord_list_guild_templates",
    arguments: { guild_id: "invalid" },
  });
  expect(errorOf(result)).toMatchObject({ category: "validation" });
  expect(makeRequest).not.toHaveBeenCalled();
});

it("allows guilds in the allowlist and sends expected request", async () => {
  const { client, request } = await harness({
    policy: new PPolicyEngine(["123"], ["core", "guild"], false),
    respond: () => [TEMPLATE],
  });
  const result = await client.callTool({
    name: "discord_list_guild_templates",
    arguments: { guild_id: "123" },
  });
  expect(result.structuredContent).toEqual({ templates: [TEMPLATE] });
  const { url, method } = request();
  expect([method, url]).toEqual(["GET", "https://discord.com/api/v10/guilds/123/templates"]);
});

it("blocks guilds outside the allowlist", async () => {
  const { client, makeRequest } = await harness({
    policy: new PPolicyEngine(["999"], ["core", "guild"], false),
  });
  const result = await client.callTool({
    name: "discord_list_guild_templates",
    arguments: { guild_id: "123" },
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
    name: "discord_list_guild_templates",
    arguments: { guild_id: "123" },
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
    makeRequest: async () => json({ message: "Unknown Guild", code: 10004 }, { status: 404 }),
  });
  const result = await client.callTool({
    name: "discord_list_guild_templates",
    arguments: { guild_id: "123" },
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
