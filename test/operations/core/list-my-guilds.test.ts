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

it("lists guilds without filtering when no allowlist is active, returning cursors when full page", async () => {
  const { client, request } = await harness({
    policy,
    respond: () => [GUILD_1, GUILD_2],
  });
  const result = await client.callTool({
    name: "discord_list_my_guilds",
    arguments: { limit: 2, with_counts: true },
  });
  expect(result.structuredContent).toEqual({
    guilds: [GUILD_1, GUILD_2],
    next_before: "100000000000000001",
    next_after: "100000000000000002",
  });
  const { url, method, body } = request();
  expect([method, url, body]).toEqual([
    "GET",
    "https://discord.com/api/v10/users/@me/guilds?limit=2&with_counts=true",
    null,
  ]);
});

it("returns null cursors without an allowlist when page is shorter than requested limit", async () => {
  const { client, request } = await harness({
    policy,
    respond: () => [GUILD_1, GUILD_2],
  });
  const result = await client.callTool({
    name: "discord_list_my_guilds",
    arguments: { limit: 10 },
  });
  expect(result.structuredContent).toEqual({
    guilds: [GUILD_1, GUILD_2],
    next_before: null,
    next_after: null,
  });
  const { url, method } = request();
  expect([method, url]).toEqual(["GET", "https://discord.com/api/v10/users/@me/guilds?limit=10"]);
});

it("filters guilds outside the allowlist across multiple internal pages and returns null cursors", async () => {
  const HIDDEN_1 = { id: "999000000000000001", name: "Hidden Guild 1" };
  const HIDDEN_2 = { id: "999000000000000002", name: "Hidden Guild 2" };

  // Page 1 has 200 guilds: 1 allowed, 199 hidden
  const page1 = [
    GUILD_1,
    ...Array.from({ length: 199 }, (_, i) => ({
      id: `888000000000000${String(i).padStart(3, "0")}`,
      name: `Hidden P1 ${i}`,
    })),
  ];
  // Page 2 has 2 guilds: HIDDEN_1 and GUILD_2 (< 200, so paging terminates)
  const page2 = [HIDDEN_1, { ...HIDDEN_2 }, GUILD_2];

  const requests: string[] = [];
  const { client } = await harness({
    policy: new PPolicyEngine([GUILD_1.id, GUILD_2.id], ["core"], false),
    makeRequest: async (url) => {
      requests.push(String(url));
      if (requests.length === 1) {
        return json(page1);
      }
      return json(page2);
    },
  });

  const result = await client.callTool({
    name: "discord_list_my_guilds",
    arguments: { with_counts: true },
  });

  expect(result.structuredContent).toEqual({
    guilds: [GUILD_1, GUILD_2],
    next_before: null,
    next_after: null,
  });

  // Assert literal output contains NO hidden ID anywhere (JSON string check)
  const jsonOutput = JSON.stringify(result.structuredContent);
  expect(jsonOutput).not.toContain("999000000000000001");
  expect(jsonOutput).not.toContain("999000000000000002");
  expect(jsonOutput).not.toContain("888000000000000");

  // Assert literal requests made
  expect(requests).toEqual([
    "https://discord.com/api/v10/users/@me/guilds?limit=200&with_counts=true",
    `https://discord.com/api/v10/users/@me/guilds?limit=200&after=${page1.at(-1)?.id}&with_counts=true`,
  ]);
});

it("refuses paging inputs under an allowlist with validation error", async () => {
  const { client } = await harness({
    policy: new PPolicyEngine([GUILD_1.id], ["core"], false),
  });
  for (const input of [{ before: "100" }, { after: "100" }, { limit: 10 }]) {
    const result = await client.callTool({
      name: "discord_list_my_guilds",
      arguments: input,
    });
    expect(errorOf(result)).toMatchObject({
      category: "validation",
      retryable: false,
      message:
        "Paging is not available with DISCORD_MCP_ALLOWED_GUILDS; every allowed guild is returned in one call",
    });
  }
});

it("returns all allowed guilds in one call when more allowed guilds than one Discord page holds", async () => {
  // 250 allowed guilds across 2 pages (200 on page 1, 50 on page 2)
  const allowedGuilds = Array.from({ length: 250 }, (_, i) => ({
    id: `700000000000000${String(i).padStart(3, "0")}`,
    name: `Allowed Guild ${i}`,
    icon: null,
    owner: false,
    permissions: "0",
    features: [],
  }));
  const page1 = allowedGuilds.slice(0, 200);
  const page2 = allowedGuilds.slice(200);

  const { client } = await harness({
    policy: new PPolicyEngine(
      allowedGuilds.map((g) => g.id),
      ["core"],
      false,
    ),
    makeRequest: async (url) => {
      const u = new URL(String(url));
      if (!u.searchParams.get("after")) return json(page1);
      return json(page2);
    },
  });

  const result = await client.callTool({
    name: "discord_list_my_guilds",
    arguments: {},
  });
  expect(result.structuredContent).toEqual({
    guilds: allowedGuilds,
    next_before: null,
    next_after: null,
  });
});

it("returns null cursors when Discord returns empty list", async () => {
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
    next_before: null,
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
