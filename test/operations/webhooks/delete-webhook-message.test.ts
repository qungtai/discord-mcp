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

const WEBHOOK = {
  id: "101",
  guild_id: "201",
  channel_id: "301",
  token: "my-secret-webhook-token",
};

const empty204 = () => new Response(null, { status: 204 }) as unknown as ResponseLike;

it("deletes a webhook message after approval without auth header", async () => {
  const { client, request, makeRequest } = await toolHarness("discord_delete_webhook_message", {
    makeRequest: async (url) => {
      if (String(url).endsWith("/webhooks/101")) {
        return json(WEBHOOK);
      }
      return empty204();
    },
  });

  const result = await client.callTool({
    name: "discord_delete_webhook_message",
    arguments: {
      webhook_id: "101",
      message_id: "501",
      thread_id: "401",
    },
  });

  expect(result.structuredContent).toEqual({
    deleted: true,
    webhook_id: "101",
    message_id: "501",
  });
  expect(makeRequest).toHaveBeenCalledTimes(2);

  // Request 0 is token lookup
  expect(request(0).method).toBe("GET");
  expect(request(0).url).toBe("https://discord.com/api/v10/webhooks/101");

  // Request 1 is DELETE message without auth header
  const req = request(1);
  expect(req.method).toBe("DELETE");
  expect(req.url).toBe(
    "https://discord.com/api/v10/webhooks/101/my-secret-webhook-token/messages/501?thread_id=401",
  );
  expect(new Headers(req.headers as HeadersInit).has("authorization")).toBe(false);
});

it("passes allowlist check when both webhook and thread guilds are allowed", async () => {
  const { client, makeRequest } = await toolHarness("discord_delete_webhook_message", {
    policy: new PPolicyEngine(["201"], ["webhooks"], false),
    makeRequest: async (url) => {
      if (String(url).endsWith("/webhooks/101")) {
        return json(WEBHOOK);
      }
      if (String(url).endsWith("/channels/401")) {
        return json({ id: "401", guild_id: "201" });
      }
      return empty204();
    },
  });

  const result = await client.callTool({
    name: "discord_delete_webhook_message",
    arguments: {
      webhook_id: "101",
      message_id: "501",
      thread_id: "401",
    },
  });

  expect(result.isError).toBeFalsy();
  expect(makeRequest).toHaveBeenCalledTimes(4);
});

it("denies access when thread belongs to a disallowed guild", async () => {
  const { client } = await toolHarness("discord_delete_webhook_message", {
    policy: new PPolicyEngine(["201"], ["webhooks"], false),
    makeRequest: async (url) => {
      if (String(url).endsWith("/webhooks/101")) {
        return json(WEBHOOK);
      }
      if (String(url).endsWith("/channels/401")) {
        return json({ id: "401", guild_id: "999" });
      }
      return empty204();
    },
  });

  const result = await client.callTool({
    name: "discord_delete_webhook_message",
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

it("blocks mutating call in read-only mode", async () => {
  const { client, makeRequest } = await toolHarness("discord_delete_webhook_message", {
    policy: new PPolicyEngine([], ["webhooks"], true),
  });

  const result = await client.callTool({
    name: "discord_delete_webhook_message",
    arguments: {
      webhook_id: "101",
      message_id: "501",
    },
  });

  expect(errorOf(result)).toMatchObject({
    category: "policy",
    message: "Read-only mode",
  });
  expect(makeRequest).not.toHaveBeenCalled();
});
