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
  name: "Community Template",
  description: "A starter community template",
  usage_count: 42,
  creator_id: "999",
  source_guild_id: "123",
};

it("gets a guild template by code", async () => {
  const { client, request } = await harness({
    policy,
    respond: () => TEMPLATE,
  });
  const result = await client.callTool({
    name: "discord_get_guild_template",
    arguments: { code: "abc123xyz" },
  });
  expect(result.structuredContent).toEqual({ template: TEMPLATE });
  const { url, method } = request();
  expect([method, url]).toEqual(["GET", "https://discord.com/api/v10/guilds/templates/abc123xyz"]);
});

it("rejects empty code", async () => {
  const { client, makeRequest } = await harness({ policy });
  const result = await client.callTool({
    name: "discord_get_guild_template",
    arguments: { code: "" },
  });
  expect(errorOf(result)).toMatchObject({ category: "validation" });
  expect(makeRequest).not.toHaveBeenCalled();
});

it("allows access regardless of guild allowlist because scope is none", async () => {
  const { client } = await harness({
    policy: new PPolicyEngine(["888"], ["core", "guild"], false),
    respond: () => TEMPLATE,
  });
  const result = await client.callTool({
    name: "discord_get_guild_template",
    arguments: { code: "abc123xyz" },
  });
  expect(result.structuredContent).toEqual({ template: TEMPLATE });
});

it("maps 404 to not_found error", async () => {
  const { client } = await harness({
    policy,
    makeRequest: async () => json({ message: "Unknown Template", code: 10057 }, { status: 404 }),
  });
  const result = await client.callTool({
    name: "discord_get_guild_template",
    arguments: { code: "nonexistent" },
  });
  expect(errorOf(result)).toMatchObject({
    category: "not_found",
    status: 404,
  });
});
