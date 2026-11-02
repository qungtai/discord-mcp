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
  id: "100",
  name: "Moderator",
  color: 3447003,
  position: 1,
  permissions: "8",
  managed: false,
};

it("lists guild roles", async () => {
  const { client, request } = await harness({
    policy,
    respond: () => [ROLE],
  });
  const result = await client.callTool({
    name: "discord_list_guild_roles",
    arguments: { guild_id: "123" },
  });
  expect(result.structuredContent).toEqual({ roles: [ROLE] });
  const { url, method } = request();
  expect([method, url]).toEqual(["GET", "https://discord.com/api/v10/guilds/123/roles"]);
});

it("rejects invalid guild_id", async () => {
  const { client, makeRequest } = await harness({ policy });
  const result = await client.callTool({
    name: "discord_list_guild_roles",
    arguments: { guild_id: "invalid" },
  });
  expect(errorOf(result)).toMatchObject({ category: "validation" });
  expect(makeRequest).not.toHaveBeenCalled();
});

it("allows guilds in the allowlist", async () => {
  const { client } = await harness({
    policy: new PPolicyEngine(["123"], ["core", "roles"], false),
    respond: () => [ROLE],
  });
  const result = await client.callTool({
    name: "discord_list_guild_roles",
    arguments: { guild_id: "123" },
  });
  expect(result.structuredContent).toEqual({ roles: [ROLE] });
});

it("blocks guilds outside the allowlist", async () => {
  const { client, makeRequest } = await harness({
    policy: new PPolicyEngine(["999"], ["core", "roles"], false),
  });
  const result = await client.callTool({
    name: "discord_list_guild_roles",
    arguments: { guild_id: "123" },
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
    name: "discord_list_guild_roles",
    arguments: { guild_id: "123" },
  });
  expect(errorOf(result)).toMatchObject({
    category: "permission",
    status: 403,
    discord_code: 50013,
  });
});
