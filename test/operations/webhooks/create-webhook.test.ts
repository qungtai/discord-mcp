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

const CREATED_WEBHOOK = {
  id: "101",
  type: 1,
  guild_id: "201",
  channel_id: "301",
  name: "New Webhook",
  avatar: "avatarhash",
  token: "secret-token-xyz",
  url: "https://discord.com/api/webhooks/101/secret-token-xyz",
};

it("creates a webhook with avatar and reason, and drops token and url", async () => {
  const { client, request } = await harness({
    policy: new PPolicyEngine([], ["webhooks"], false),
    respond: () => CREATED_WEBHOOK,
  });
  const result = await client.callTool({
    name: "discord_create_webhook",
    arguments: {
      channel_id: "301",
      name: "New Webhook",
      avatar: "data:image/png;base64,aGVsbG8=",
      reason: "integration setup",
    },
  });
  const req = request();
  expect(req.method).toBe("POST");
  expect(req.url).toBe("https://discord.com/api/v10/channels/301/webhooks");
  expect(new Headers(req.headers as HeadersInit).get("x-audit-log-reason")).toBe(
    "integration%20setup",
  );
  expect(JSON.parse(String(req.body))).toEqual({
    name: "New Webhook",
    avatar: "data:image/png;base64,aGVsbG8=",
  });

  const sanitized = { ...CREATED_WEBHOOK };
  delete (sanitized as Record<string, unknown>).token;
  delete (sanitized as Record<string, unknown>).url;

  expect(result.structuredContent).toEqual({
    webhook: sanitized,
  });
});

it("passes allowlist check when channel's guild is allowed", async () => {
  const { client, request, makeRequest } = await harness({
    policy: new PPolicyEngine(["201"], ["webhooks"], false),
    makeRequest: async (url) => {
      if (String(url).endsWith("/channels/301")) {
        return json({ id: "301", guild_id: "201" });
      }
      return json(CREATED_WEBHOOK);
    },
  });
  const result = await client.callTool({
    name: "discord_create_webhook",
    arguments: { channel_id: "301", name: "New Webhook" },
  });
  expect(result.isError).toBeFalsy();
  expect(makeRequest).toHaveBeenCalledTimes(2);
  expect(request(0).method).toBe("GET");
  expect(request(1).method).toBe("POST");
});

it("denies access when channel's guild is not allowed", async () => {
  const { client, makeRequest } = await harness({
    policy: new PPolicyEngine(["999"], ["webhooks"], false),
    makeRequest: async () => json({ id: "301", guild_id: "201" }),
  });
  const result = await client.callTool({
    name: "discord_create_webhook",
    arguments: { channel_id: "301", name: "New Webhook" },
  });
  expect(errorOf(result)).toMatchObject({
    category: "policy",
    message: "Guild is not allowed",
  });
  expect(makeRequest).toHaveBeenCalledTimes(1);
});

it("blocks mutating call in read-only mode", async () => {
  const { client, makeRequest } = await harness({
    policy: new PPolicyEngine([], ["webhooks"], true),
  });
  const result = await client.callTool({
    name: "discord_create_webhook",
    arguments: { channel_id: "301", name: "New Webhook" },
  });
  expect(errorOf(result)).toMatchObject({ category: "policy", message: "Read-only mode" });
  expect(makeRequest).not.toHaveBeenCalled();
});

it("maps 403 to permission error with ManageWebhooks remediation", async () => {
  const { client } = await harness({
    policy: new PPolicyEngine([], ["webhooks"], false),
    makeRequest: async () => json({ message: "Missing Permissions", code: 50013 }, { status: 403 }),
  });
  const result = await client.callTool({
    name: "discord_create_webhook",
    arguments: { channel_id: "301", name: "New Webhook" },
  });
  expect(errorOf(result)).toMatchObject({
    category: "permission",
    status: 403,
    discord_code: 50013,
    remediation: "Check the bot permissions; this tool needs ManageWebhooks",
  });
});

it("fails validation on invalid name length", async () => {
  const { client, makeRequest } = await harness({
    policy: new PPolicyEngine([], ["webhooks"], false),
  });
  const result = await client.callTool({
    name: "discord_create_webhook",
    arguments: { channel_id: "301", name: "" },
  });
  expect(errorOf(result)).toMatchObject({
    category: "validation",
  });
  expect(makeRequest).not.toHaveBeenCalled();
});
