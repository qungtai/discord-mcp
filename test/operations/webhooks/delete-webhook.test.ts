import type { ResponseLike } from "@discordjs/rest";
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

const empty204 = () => new Response(null, { status: 204 }) as unknown as ResponseLike;

it("deletes a webhook permanently with audit reason", async () => {
  const { client, request } = await toolHarness("discord_delete_webhook", {
    makeRequest: async () => empty204(),
  });
  const result = await client.callTool({
    name: "discord_delete_webhook",
    arguments: { webhook_id: "101", reason: "cleanup webhook" },
  });
  const req = request();
  expect(req.method).toBe("DELETE");
  expect(req.url).toBe("https://discord.com/api/v10/webhooks/101");
  expect(new Headers(req.headers as HeadersInit).get("x-audit-log-reason")).toBe(
    "cleanup%20webhook",
  );
  expect(result.structuredContent).toEqual({
    deleted: true,
    webhook_id: "101",
  });
});

it("passes allowlist check when webhook's guild is allowed", async () => {
  const { client, makeRequest } = await toolHarness("discord_delete_webhook", {
    policy: new PPolicyEngine(["201"], ["webhooks"], false),
    makeRequest: async (url) => {
      if (String(url).endsWith("/webhooks/101")) {
        return json({ id: "101", guild_id: "201" });
      }
      return empty204();
    },
  });
  const result = await client.callTool({
    name: "discord_delete_webhook",
    arguments: { webhook_id: "101" },
  });
  expect(result.isError).toBeFalsy();
  expect(makeRequest).toHaveBeenCalledTimes(2);
});

it("denies access when webhook's guild is not allowed", async () => {
  const { client, makeRequest } = await toolHarness("discord_delete_webhook", {
    policy: new PPolicyEngine(["999"], ["webhooks"], false),
    makeRequest: async () => json({ id: "101", guild_id: "201" }),
  });
  const result = await client.callTool({
    name: "discord_delete_webhook",
    arguments: { webhook_id: "101" },
  });
  expect(errorOf(result)).toMatchObject({
    category: "policy",
    message: "Guild is not allowed",
  });
  expect(makeRequest).toHaveBeenCalledTimes(1);
});

it("blocks mutating call in read-only mode", async () => {
  const { client, makeRequest } = await toolHarness("discord_delete_webhook", {
    policy: new PPolicyEngine([], ["webhooks"], true),
  });
  const result = await client.callTool({
    name: "discord_delete_webhook",
    arguments: { webhook_id: "101" },
  });
  expect(errorOf(result)).toMatchObject({ category: "policy", message: "Read-only mode" });
  expect(makeRequest).not.toHaveBeenCalled();
});

it("maps 403 to permission error with ManageWebhooks remediation", async () => {
  const { client } = await toolHarness("discord_delete_webhook", {
    makeRequest: async () => json({ message: "Missing Permissions", code: 50013 }, { status: 403 }),
  });
  const result = await client.callTool({
    name: "discord_delete_webhook",
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
  const { client } = await toolHarness("discord_delete_webhook", {
    makeRequest: async () => json({ message: "Unknown Webhook", code: 10015 }, { status: 404 }),
  });
  const result = await client.callTool({
    name: "discord_delete_webhook",
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
  const { client, makeRequest } = await toolHarness("discord_delete_webhook");
  const result = await client.callTool({
    name: "discord_delete_webhook",
    arguments: { webhook_id: "not-a-snowflake" },
  });
  expect(errorOf(result)).toMatchObject({
    category: "validation",
  });
  expect(makeRequest).not.toHaveBeenCalled();
});
