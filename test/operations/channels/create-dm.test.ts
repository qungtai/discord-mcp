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

const policy = new PPolicyEngine([], ["channels"], false);

const DM_CHANNEL = {
  id: "300000000000000001",
  type: 1,
  recipient_id: "200000000000000002",
};

it("creates dm channel when no allowlist is active", async () => {
  const { client, request } = await harness({
    policy,
    respond: () => DM_CHANNEL,
  });
  const result = await client.callTool({
    name: "discord_create_dm",
    arguments: { recipient_id: "200000000000000002" },
  });
  expect(result.structuredContent).toEqual({ channel: DM_CHANNEL });
  const { url, method, body } = request();
  expect([method, url, JSON.parse(String(body))]).toEqual([
    "POST",
    "https://discord.com/api/v10/users/@me/channels",
    { recipient_id: "200000000000000002" },
  ]);
});

it("succeeds under allowlist when DISCORD_MCP_ALLOW_DMS is enabled", async () => {
  const { client, request } = await harness({
    policy: new PPolicyEngine(["100000000000000001"], ["channels"], false, "elicitation", true),
    respond: () => DM_CHANNEL,
  });
  const result = await client.callTool({
    name: "discord_create_dm",
    arguments: { recipient_id: "200000000000000002" },
  });
  expect(result.structuredContent).toEqual({ channel: DM_CHANNEL });
  const { url, method, body } = request();
  expect([method, url, JSON.parse(String(body))]).toEqual([
    "POST",
    "https://discord.com/api/v10/users/@me/channels",
    { recipient_id: "200000000000000002" },
  ]);
});

it("denies under allowlist when DISCORD_MCP_ALLOW_DMS is disabled with zero writes", async () => {
  const { client, makeRequest } = await harness({
    policy: new PPolicyEngine(["100000000000000001"], ["channels"], false, "elicitation", false),
  });
  const result = await client.callTool({
    name: "discord_create_dm",
    arguments: { recipient_id: "200000000000000002" },
  });
  expect(errorOf(result)).toMatchObject({
    category: "policy",
    retryable: false,
    message: "Guild is not allowed",
    remediation: "Choose an allowed guild",
  });
  expect(makeRequest).not.toHaveBeenCalled();
});

it("rejects non-snowflake recipient_id", async () => {
  const { client, makeRequest } = await harness({ policy });
  const result = await client.callTool({
    name: "discord_create_dm",
    arguments: { recipient_id: "invalid" },
  });
  expect(errorOf(result)).toMatchObject({ category: "validation" });
  expect(makeRequest).not.toHaveBeenCalled();
});

it("maps 403 to permission error", async () => {
  const { client } = await harness({
    policy,
    makeRequest: async () =>
      json({ message: "Cannot send messages to this user", code: 50007 }, { status: 403 }),
  });
  const result = await client.callTool({
    name: "discord_create_dm",
    arguments: { recipient_id: "200000000000000002" },
  });
  expect(errorOf(result)).toMatchObject({
    category: "permission",
    status: 403,
    discord_code: 50007,
    retryable: false,
    message: "Discord rejected the request (HTTP 403): Cannot send messages to this user",
    remediation: "Check the bot permissions",
  });
});

it("maps 404 to not_found error", async () => {
  const { client } = await harness({
    policy,
    makeRequest: async () => json({ message: "Unknown User", code: 10013 }, { status: 404 }),
  });
  const result = await client.callTool({
    name: "discord_create_dm",
    arguments: { recipient_id: "200000000000000002" },
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
