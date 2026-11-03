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
  name: "My Webhook",
  avatar: "avatarhash",
  token: "secret-token-123",
  url: "https://discord.com/api/webhooks/101/secret-token-123",
};

it("gets a webhook by ID and drops token and url", async () => {
  const { client, request } = await harness({
    policy: new PPolicyEngine([], ["webhooks"], false),
    respond: () => WEBHOOK,
  });
  const result = await client.callTool({
    name: "discord_get_webhook",
    arguments: { webhook_id: "101" },
  });
  expect(request().method).toBe("GET");
  expect(request().url).toBe("https://discord.com/api/v10/webhooks/101");

  const sanitized = { ...WEBHOOK };
  delete (sanitized as Record<string, unknown>).token;
  delete (sanitized as Record<string, unknown>).url;

  expect(result.structuredContent).toEqual({
    webhook: sanitized,
  });
});

it("passes allowlist check when webhook's guild is allowed", async () => {
  const { client, request, makeRequest } = await harness({
    policy: new PPolicyEngine(["201"], ["webhooks"], false),
    respond: () => WEBHOOK,
  });
  const result = await client.callTool({
    name: "discord_get_webhook",
    arguments: { webhook_id: "101" },
  });
  expect(result.isError).toBeFalsy();
  expect(makeRequest).toHaveBeenCalledTimes(2);
  expect(request(0).method).toBe("GET");
  expect(request(1).method).toBe("GET");
});

it("denies access when webhook's guild is not allowed", async () => {
  const { client, makeRequest } = await harness({
    policy: new PPolicyEngine(["999"], ["webhooks"], false),
    respond: () => WEBHOOK,
  });
  const result = await client.callTool({
    name: "discord_get_webhook",
    arguments: { webhook_id: "101" },
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
    name: "discord_get_webhook",
    arguments: { webhook_id: "101" },
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
    makeRequest: async () => json({ message: "Unknown Webhook", code: 10015 }, { status: 404 }),
  });
  const result = await client.callTool({
    name: "discord_get_webhook",
    arguments: { webhook_id: "101" },
  });
  expect(errorOf(result)).toMatchObject({
    category: "not_found",
    status: 404,
    discord_code: 10015,
    remediation: "Check the IDs in the request",
  });
});

it("fails validation on invalid webhook_id", async () => {
  const { client, makeRequest } = await harness({
    policy: new PPolicyEngine([], ["webhooks"], false),
  });
  const result = await client.callTool({
    name: "discord_get_webhook",
    arguments: { webhook_id: "bad-id" },
  });
  expect(errorOf(result)).toMatchObject({
    category: "validation",
  });
  expect(makeRequest).not.toHaveBeenCalled();
});
