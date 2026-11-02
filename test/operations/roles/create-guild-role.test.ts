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

const CREATED_ROLE = {
  id: "789",
  name: "VIP",
  color: 16711680,
  position: 3,
  permissions: "0",
  managed: false,
};

it("creates a guild role with optional fields and reason", async () => {
  const { client, request } = await harness({
    policy,
    respond: () => CREATED_ROLE,
  });
  const result = await client.callTool({
    name: "discord_create_guild_role",
    arguments: {
      guild_id: "123",
      name: "VIP",
      color: 16711680,
      hoist: true,
      mentionable: true,
      reason: "special members",
    },
  });
  expect(result.structuredContent).toEqual({ role: CREATED_ROLE });
  const { url, method, body, headers } = request();
  expect([method, url]).toEqual(["POST", "https://discord.com/api/v10/guilds/123/roles"]);
  expect(headers).toMatchObject({ "X-Audit-Log-Reason": "special%20members" });
  expect(JSON.parse(String(body))).toEqual({
    name: "VIP",
    color: 16711680,
    hoist: true,
    mentionable: true,
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

it("allows guilds in the allowlist", async () => {
  const { client } = await harness({
    policy: new PPolicyEngine(["123"], ["core", "roles"], false),
    respond: () => CREATED_ROLE,
  });
  const result = await client.callTool({
    name: "discord_create_guild_role",
    arguments: { guild_id: "123", name: "VIP" },
  });
  expect(result.structuredContent).toEqual({ role: CREATED_ROLE });
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

it("maps 403 to permission error", async () => {
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
  });
});
