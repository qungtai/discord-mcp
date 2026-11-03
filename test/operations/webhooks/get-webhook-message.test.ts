import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { PPolicyEngine } from "../../../src/core/policy.js";
import { errorOf, harness, json, MESSAGE } from "../../support/harness.js";

beforeEach(() => {
  vi.spyOn(process.stderr, "write").mockReturnValue(true);
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const WEBHOOK = {
  id: "101",
  guild_id: "201",
  channel_id: "301",
  token: "my-secret-webhook-token",
};

it("gets a webhook message by ID, fetching token first and without auth header", async () => {
  const { client, request, makeRequest } = await harness({
    policy: new PPolicyEngine([], ["webhooks"], false),
    makeRequest: async (url) => {
      if (String(url).endsWith("/webhooks/101")) {
        return json(WEBHOOK);
      }
      return json(MESSAGE);
    },
  });

  const result = await client.callTool({
    name: "discord_get_webhook_message",
    arguments: {
      webhook_id: "101",
      message_id: "501",
      thread_id: "401",
    },
  });

  expect(result.structuredContent).toEqual({ message: MESSAGE });
  expect(makeRequest).toHaveBeenCalledTimes(2);

  // First request is to fetch webhook to get token (using bot auth)
  expect(request(0).method).toBe("GET");
  expect(request(0).url).toBe("https://discord.com/api/v10/webhooks/101");
  expect(new Headers(request(0).headers as HeadersInit).get("authorization")).toBe(
    "Bot test-token",
  );

  // Second request is to get message by token (no auth header, thread_id query)
  const req = request(1);
  expect(req.method).toBe("GET");
  expect(req.url).toBe(
    "https://discord.com/api/v10/webhooks/101/my-secret-webhook-token/messages/501?thread_id=401",
  );
  expect(new Headers(req.headers as HeadersInit).has("authorization")).toBe(false);
});

it("passes allowlist check when both webhook and thread guilds are allowed", async () => {
  const { client } = await harness({
    policy: new PPolicyEngine(["201"], ["webhooks"], false),
    makeRequest: async (url) => {
      if (String(url).endsWith("/webhooks/101")) {
        return json(WEBHOOK);
      }
      if (String(url).endsWith("/channels/401")) {
        return json({ id: "401", guild_id: "201" });
      }
      return json(MESSAGE);
    },
  });

  const result = await client.callTool({
    name: "discord_get_webhook_message",
    arguments: {
      webhook_id: "101",
      message_id: "501",
      thread_id: "401",
    },
  });

  expect(result.isError).toBeFalsy();
});

it("denies access when thread belongs to a disallowed guild", async () => {
  const { client } = await harness({
    policy: new PPolicyEngine(["201"], ["webhooks"], false),
    makeRequest: async (url) => {
      if (String(url).endsWith("/webhooks/101")) {
        return json(WEBHOOK);
      }
      if (String(url).endsWith("/channels/401")) {
        return json({ id: "401", guild_id: "999" });
      }
      return json(MESSAGE);
    },
  });

  const result = await client.callTool({
    name: "discord_get_webhook_message",
    arguments: {
      webhook_id: "101",
      message_id: "501",
      thread_id: "401",
    },
  });

  expect(errorOf(result)).toMatchObject({
    category: "policy",
    message: "Guild is not allowed",
  });
});

it("fails with validation error when webhook has no token", async () => {
  const { client } = await harness({
    policy: new PPolicyEngine([], ["webhooks"], false),
    makeRequest: async (url) => {
      if (String(url).endsWith("/webhooks/101")) {
        return json({ id: "101", guild_id: "201" }); // no token
      }
      return json(MESSAGE);
    },
  });

  const result = await client.callTool({
    name: "discord_get_webhook_message",
    arguments: {
      webhook_id: "101",
      message_id: "501",
    },
  });

  expect(errorOf(result)).toMatchObject({
    category: "validation",
    retryable: false,
    message: "Only incoming webhooks can post; create one with discord_create_webhook",
    remediation: "Only incoming webhooks can post; create one with discord_create_webhook",
  });
});

it("maps 404 to not_found error", async () => {
  const { client } = await harness({
    policy: new PPolicyEngine([], ["webhooks"], false),
    makeRequest: async (url) => {
      if (String(url).endsWith("/webhooks/101")) {
        return json(WEBHOOK);
      }
      return json({ message: "Unknown Message", code: 10008 }, { status: 404 });
    },
  });

  const result = await client.callTool({
    name: "discord_get_webhook_message",
    arguments: {
      webhook_id: "101",
      message_id: "501",
    },
  });

  expect(errorOf(result)).toMatchObject({
    category: "not_found",
    status: 404,
    discord_code: 10008,
    remediation: "Check the IDs in the request",
  });
});
