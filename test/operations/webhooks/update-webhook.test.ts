import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { PPolicyEngine } from "../../../src/core/policy.js";
import { errorOf, json, toolHarness } from "../../support/harness.js";

beforeEach(() => {
  vi.spyOn(process.stderr, "write").mockReturnValue(true);
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const UPDATED_WEBHOOK = {
  id: "101",
  type: 1,
  guild_id: "201",
  channel_id: "302",
  name: "Updated Name",
  avatar: "newavatarhash",
  token: "secret-token-123",
  url: "https://discord.com/api/webhooks/101/secret-token-123",
};

it("updates a webhook and drops token and url", async () => {
  const { client, request } = await toolHarness("discord_update_webhook", {
    respond: () => UPDATED_WEBHOOK,
  });
  const result = await client.callTool({
    name: "discord_update_webhook",
    arguments: {
      webhook_id: "101",
      name: "Updated Name",
      avatar: "data:image/png;base64,bmV3",
      channel_id: "302",
      reason: "moving webhook",
    },
  });
  const req = request();
  expect(req.method).toBe("PATCH");
  expect(req.url).toBe("https://discord.com/api/v10/webhooks/101");
  expect(new Headers(req.headers as HeadersInit).get("x-audit-log-reason")).toBe(
    "moving%20webhook",
  );
  expect(JSON.parse(String(req.body))).toEqual({
    name: "Updated Name",
    avatar: "data:image/png;base64,bmV3",
    channel_id: "302",
  });

  const sanitized = { ...UPDATED_WEBHOOK };
  delete (sanitized as Record<string, unknown>).token;
  delete (sanitized as Record<string, unknown>).url;

  expect(result.structuredContent).toEqual({
    webhook: sanitized,
  });
});

it("passes allowlist check when both webhook and target channel guilds are allowed", async () => {
  const { client, request, makeRequest } = await toolHarness("discord_update_webhook", {
    policy: new PPolicyEngine(["201"], ["webhooks"], false),
    makeRequest: async (url) => {
      if (String(url).endsWith("/webhooks/101")) {
        return json({ id: "101", guild_id: "201" });
      }
      if (String(url).endsWith("/channels/302")) {
        return json({ id: "302", guild_id: "201" });
      }
      return json(UPDATED_WEBHOOK);
    },
  });
  const result = await client.callTool({
    name: "discord_update_webhook",
    arguments: { webhook_id: "101", channel_id: "302" },
  });
  expect(result.isError).toBeFalsy();
  expect(makeRequest).toHaveBeenCalledTimes(3);
  const finalReq = request(2);
  expect(finalReq.method).toBe("PATCH");
  expect(finalReq.url).toBe("https://discord.com/api/v10/webhooks/101");
});

it("denies access when target channel belongs to a different disallowed guild", async () => {
  const { client, makeRequest } = await toolHarness("discord_update_webhook", {
    policy: new PPolicyEngine(["201"], ["webhooks"], false),
    makeRequest: async (url) => {
      if (String(url).endsWith("/webhooks/101")) {
        return json({ id: "101", guild_id: "201" });
      }
      if (String(url).endsWith("/channels/302")) {
        return json({ id: "302", guild_id: "999" });
      }
      return json(UPDATED_WEBHOOK);
    },
  });
  const result = await client.callTool({
    name: "discord_update_webhook",
    arguments: { webhook_id: "101", channel_id: "302" },
  });
  expect(errorOf(result)).toMatchObject({
    category: "policy",
    message: "Guild is not allowed",
  });
  expect(makeRequest).toHaveBeenCalledTimes(2);
});

it("blocks mutating call in read-only mode", async () => {
  const { client, makeRequest } = await toolHarness("discord_update_webhook", {
    policy: new PPolicyEngine([], ["webhooks"], true),
  });
  const result = await client.callTool({
    name: "discord_update_webhook",
    arguments: { webhook_id: "101", name: "New Name" },
  });
  expect(errorOf(result)).toMatchObject({ category: "policy", message: "Read-only mode" });
  expect(makeRequest).not.toHaveBeenCalled();
});

it("maps 403 to permission error with ManageWebhooks remediation", async () => {
  const { client } = await toolHarness("discord_update_webhook", {
    makeRequest: async () => json({ message: "Missing Permissions", code: 50013 }, { status: 403 }),
  });
  const result = await client.callTool({
    name: "discord_update_webhook",
    arguments: { webhook_id: "101", name: "New Name" },
  });
  expect(errorOf(result)).toMatchObject({
    category: "permission",
    status: 403,
    discord_code: 50013,
    remediation: "Check the bot permissions; this tool needs ManageWebhooks",
  });
});

it("maps 404 to not_found error", async () => {
  const { client } = await toolHarness("discord_update_webhook", {
    makeRequest: async () => json({ message: "Unknown Webhook", code: 10015 }, { status: 404 }),
  });
  const result = await client.callTool({
    name: "discord_update_webhook",
    arguments: { webhook_id: "101", name: "New Name" },
  });
  expect(errorOf(result)).toMatchObject({
    category: "not_found",
    status: 404,
    discord_code: 10015,
    remediation: "Check the IDs in the request",
  });
});

it("fails validation on invalid webhook_id", async () => {
  const { client, makeRequest } = await toolHarness("discord_update_webhook");
  const result = await client.callTool({
    name: "discord_update_webhook",
    arguments: { webhook_id: "not-a-snowflake" },
  });
  expect(errorOf(result)).toMatchObject({
    category: "validation",
  });
  expect(makeRequest).not.toHaveBeenCalled();
});
