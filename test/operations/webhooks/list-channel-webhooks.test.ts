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
  name: "Captain Hook",
  avatar: "avatarhash",
  token: "secret-token-123",
  url: "https://discord.com/api/webhooks/101/secret-token-123",
};

it("lists channel webhooks and drops token and url", async () => {
  const { client, request } = await harness({
    policy: new PPolicyEngine([], ["webhooks"], false),
    respond: () => [WEBHOOK],
  });
  const result = await client.callTool({
    name: "discord_list_channel_webhooks",
    arguments: { channel_id: "301" },
  });
  expect(request().method).toBe("GET");
  expect(request().url).toBe("https://discord.com/api/v10/channels/301/webhooks");

  const sanitized = { ...WEBHOOK };
  delete (sanitized as Record<string, unknown>).token;
  delete (sanitized as Record<string, unknown>).url;

  expect(result.structuredContent).toEqual({
    webhooks: [sanitized],
  });
});

it("passes allowlist check when channel's guild is allowed", async () => {
  const { client, request, makeRequest } = await harness({
    policy: new PPolicyEngine(["201"], ["webhooks"], false),
    makeRequest: async (url) => {
      if (String(url).endsWith("/channels/301")) {
        return json({ id: "301", guild_id: "201" });
      }
      return json([WEBHOOK]);
    },
  });
  const result = await client.callTool({
    name: "discord_list_channel_webhooks",
    arguments: { channel_id: "301" },
  });
  expect(result.isError).toBeFalsy();
  expect(makeRequest).toHaveBeenCalledTimes(2);
  expect(request(0).method).toBe("GET");
  expect(request(1).method).toBe("GET");
});

it("denies access when channel's guild is not allowed", async () => {
  const { client, makeRequest } = await harness({
    policy: new PPolicyEngine(["999"], ["webhooks"], false),
    makeRequest: async () => json({ id: "301", guild_id: "201" }),
  });
  const result = await client.callTool({
    name: "discord_list_channel_webhooks",
    arguments: { channel_id: "301" },
  });
  expect(errorOf(result)).toMatchObject({
    category: "policy",
    message: "Guild is not allowed",
  });
  expect(makeRequest).toHaveBeenCalledTimes(1);
});

it("maps 403 to permission error with ManageWebhooks remediation", async () => {
  const { client } = await harness({
    policy: new PPolicyEngine([], ["webhooks"], false),
    makeRequest: async () => json({ message: "Missing Permissions", code: 50013 }, { status: 403 }),
  });
  const result = await client.callTool({
    name: "discord_list_channel_webhooks",
    arguments: { channel_id: "301" },
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
    makeRequest: async () => json({ message: "Unknown Channel", code: 10003 }, { status: 404 }),
  });
  const result = await client.callTool({
    name: "discord_list_channel_webhooks",
    arguments: { channel_id: "301" },
  });
  expect(errorOf(result)).toMatchObject({
    category: "not_found",
    status: 404,
    discord_code: 10003,
    remediation: "Check the IDs in the request",
  });
});

it("fails validation on invalid channel_id", async () => {
  const { client, makeRequest } = await harness({
    policy: new PPolicyEngine([], ["webhooks"], false),
  });
  const result = await client.callTool({
    name: "discord_list_channel_webhooks",
    arguments: { channel_id: "not-a-snowflake" },
  });
  expect(errorOf(result)).toMatchObject({
    category: "validation",
  });
  expect(makeRequest).not.toHaveBeenCalled();
});
