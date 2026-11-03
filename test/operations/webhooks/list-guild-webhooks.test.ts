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

const WEBHOOK = {
  id: "101",
  type: 1,
  guild_id: "201",
  channel_id: "301",
  name: "Guild Webhook",
  avatar: null,
  token: "secret-token-123",
  url: "https://discord.com/api/webhooks/101/secret-token-123",
};

it("lists guild webhooks and drops token and url", async () => {
  const { client, request } = await harness({
    policy: new PPolicyEngine([], ["webhooks"], false),
    respond: () => [WEBHOOK],
  });
  const result = await client.callTool({
    name: "discord_list_guild_webhooks",
    arguments: { guild_id: "201" },
  });
  expect(request().method).toBe("GET");
  expect(request().url).toBe("https://discord.com/api/v10/guilds/201/webhooks");

  const sanitized = { ...WEBHOOK };
  delete (sanitized as Record<string, unknown>).token;
  delete (sanitized as Record<string, unknown>).url;

  expect(result.structuredContent).toEqual({
    webhooks: [sanitized],
  });
});

it("passes allowlist check when guild is allowed", async () => {
  const { client, request, makeRequest } = await harness({
    policy: new PPolicyEngine(["201"], ["webhooks"], false),
    respond: () => [WEBHOOK],
  });
  const result = await client.callTool({
    name: "discord_list_guild_webhooks",
    arguments: { guild_id: "201" },
  });
  expect(result.isError).toBeFalsy();
  expect(makeRequest).toHaveBeenCalledTimes(1);
  expect(request().method).toBe("GET");
});

it("denies access when guild is not allowed", async () => {
  const { client, makeRequest } = await harness({
    policy: new PPolicyEngine(["999"], ["webhooks"], false),
    respond: () => [WEBHOOK],
  });
  const result = await client.callTool({
    name: "discord_list_guild_webhooks",
    arguments: { guild_id: "201" },
  });
  expect(errorOf(result)).toMatchObject({
    category: "policy",
    message: "Guild is not allowed",
  });
  expect(makeRequest).not.toHaveBeenCalled();
});

it("maps 403 to permission error with ManageWebhooks remediation", async () => {
  const { client } = await harness({
    policy: new PPolicyEngine([], ["webhooks"], false),
    makeRequest: async () => json({ message: "Missing Permissions", code: 50013 }, { status: 403 }),
  });
  const result = await client.callTool({
    name: "discord_list_guild_webhooks",
    arguments: { guild_id: "201" },
  });
  expect(errorOf(result)).toMatchObject({
    category: "permission",
    status: 403,
    discord_code: 50013,
    remediation: "Check the bot permissions; this tool needs ManageWebhooks",
  });
});

it("maps 404 to not_found error", async () => {
  const { client } = await harness({
    policy: new PPolicyEngine([], ["webhooks"], false),
    makeRequest: async () => json({ message: "Unknown Guild", code: 10004 }, { status: 404 }),
  });
  const result = await client.callTool({
    name: "discord_list_guild_webhooks",
    arguments: { guild_id: "201" },
  });
  expect(errorOf(result)).toMatchObject({
    category: "not_found",
    status: 404,
    discord_code: 10004,
    remediation: "Check the IDs in the request",
  });
});

it("fails validation on invalid guild_id", async () => {
  const { client, makeRequest } = await harness({
    policy: new PPolicyEngine([], ["webhooks"], false),
  });
  const result = await client.callTool({
    name: "discord_list_guild_webhooks",
    arguments: { guild_id: "not-a-snowflake" },
  });
  expect(errorOf(result)).toMatchObject({
    category: "validation",
  });
  expect(makeRequest).not.toHaveBeenCalled();
});
