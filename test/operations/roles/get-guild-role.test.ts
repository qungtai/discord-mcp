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

const policy = new PPolicyEngine([], ["core", "roles"], false);

const ROLE = {
  id: "456",
  name: "Admin",
  color: 255,
  position: 2,
  permissions: "16",
  managed: false,
  hoist: true,
  mentionable: true,
  icon: "role_icon",
  unicode_emoji: null,
  flags: 1,
  colors: { primary_color: 255 },
  tags: {},
};

it("gets a guild role", async () => {
  const { client, request } = await harness({
    policy,
    respond: () => ROLE,
  });
  const result = await client.callTool({
    name: "discord_get_guild_role",
    arguments: { guild_id: "123", role_id: "456" },
  });
  expect(result.structuredContent).toEqual({ role: ROLE });
  const { url, method } = request();
  expect([method, url]).toEqual(["GET", "https://discord.com/api/v10/guilds/123/roles/456"]);
});

it("rejects invalid role_id", async () => {
  const { client, makeRequest } = await harness({ policy });
  const result = await client.callTool({
    name: "discord_get_guild_role",
    arguments: { guild_id: "123", role_id: "bad" },
  });
  expect(errorOf(result)).toMatchObject({ category: "validation" });
  expect(makeRequest).not.toHaveBeenCalled();
});

it("allows guilds in the allowlist and sends expected request", async () => {
  const { client, request } = await harness({
    policy: new PPolicyEngine(["123"], ["core", "roles"], false),
    respond: () => ROLE,
  });
  const result = await client.callTool({
    name: "discord_get_guild_role",
    arguments: { guild_id: "123", role_id: "456" },
  });
  expect(result.structuredContent).toEqual({ role: ROLE });
  const { url, method } = request();
  expect([method, url]).toEqual(["GET", "https://discord.com/api/v10/guilds/123/roles/456"]);
});

it("blocks guilds outside the allowlist", async () => {
  const { client, makeRequest } = await harness({
    policy: new PPolicyEngine(["999"], ["core", "roles"], false),
  });
  const result = await client.callTool({
    name: "discord_get_guild_role",
    arguments: { guild_id: "123", role_id: "456" },
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
    makeRequest: async () => json({ message: "Missing Access", code: 50001 }, { status: 403 }),
  });
  const result = await client.callTool({
    name: "discord_get_guild_role",
    arguments: { guild_id: "123", role_id: "456" },
  });
  expect(errorOf(result)).toMatchObject({
    category: "permission",
    status: 403,
    discord_code: 50001,
    retryable: false,
    message: "Discord rejected the request (HTTP 403): Missing Access",
    remediation: "Check the bot permissions",
  });
});

it("maps 404 to not_found error with exact message and remediation", async () => {
  const { client } = await harness({
    policy,
    makeRequest: async () => json({ message: "Unknown Role", code: 10011 }, { status: 404 }),
  });
  const result = await client.callTool({
    name: "discord_get_guild_role",
    arguments: { guild_id: "123", role_id: "456" },
  });
  expect(errorOf(result)).toMatchObject({
    category: "not_found",
    status: 404,
    discord_code: 10011,
    retryable: false,
    message: "Discord rejected the request (HTTP 404): Unknown Role",
    remediation: "Check the IDs in the request",
  });
});
