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

const policy = new PPolicyEngine([], ["core"], false);

const GUILD_1 = {
  id: "100000000000000001",
  name: "Guild One",
  icon: null,
  owner: true,
  permissions: "8",
  features: ["COMMUNITY"],
};

const GUILD_2 = {
  id: "100000000000000002",
  name: "Guild Two",
  icon: "icon_hash",
  owner: false,
  permissions: "1024",
  features: [],
};

it("lists guilds without filtering when no allowlist is active", async () => {
  const { client, request } = await harness({
    policy,
    respond: () => [GUILD_1, GUILD_2],
  });
  const result = await client.callTool({
    name: "discord_list_my_guilds",
    arguments: { limit: 10, with_counts: true },
  });
  expect(result.structuredContent).toEqual({
    guilds: [GUILD_1, GUILD_2],
    next_after: "100000000000000002",
  });
  const { url, method, body } = request();
  expect([method, url, body]).toEqual([
    "GET",
    "https://discord.com/api/v10/users/@me/guilds?limit=10&with_counts=true",
    null,
  ]);
});

it("filters guilds outside the allowlist and returns next_after from the last Discord guild", async () => {
  const { client, request } = await harness({
    policy: new PPolicyEngine(["100000000000000001"], ["core"], false),
    respond: () => [GUILD_1, GUILD_2],
  });
  const result = await client.callTool({
    name: "discord_list_my_guilds",
    arguments: { limit: 50 },
  });
  expect(result.structuredContent).toEqual({
    guilds: [GUILD_1],
    next_after: "100000000000000002",
  });
  const { url, method } = request();
  expect([method, url]).toEqual(["GET", "https://discord.com/api/v10/users/@me/guilds?limit=50"]);
});

it("returns null next_after when Discord returns empty list", async () => {
  const { client } = await harness({
    policy,
    respond: () => [],
  });
  const result = await client.callTool({
    name: "discord_list_my_guilds",
    arguments: {},
  });
  expect(result.structuredContent).toEqual({
    guilds: [],
    next_after: null,
  });
});

it("rejects invalid limit parameter", async () => {
  const { client, makeRequest } = await harness({ policy });
  const result = await client.callTool({
    name: "discord_list_my_guilds",
    arguments: { limit: 250 },
  });
  expect(errorOf(result)).toMatchObject({ category: "validation" });
  expect(makeRequest).not.toHaveBeenCalled();
});

it("maps 403 to permission error", async () => {
  const { client } = await harness({
    policy,
    makeRequest: async () => json({ message: "Missing Access", code: 50001 }, { status: 403 }),
  });
  const result = await client.callTool({
    name: "discord_list_my_guilds",
    arguments: {},
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

it("maps 404 to not_found error", async () => {
  const { client } = await harness({
    policy,
    makeRequest: async () => json({ message: "Unknown User", code: 10013 }, { status: 404 }),
  });
  const result = await client.callTool({
    name: "discord_list_my_guilds",
    arguments: {},
  });
  expect(errorOf(result)).toMatchObject({
    category: "not_found",
    status: 404,
    discord_code: 10013,
    retryable: false,
    message: "Discord rejected the request (HTTP 404): Unknown User",
    remediation: "Check the IDs in the request",
  });
});
