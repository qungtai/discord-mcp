import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { PAttachmentService } from "../../../src/adapters/files/attachment-service.js";
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

async function tempDir() {
  const dir = await mkdtemp(join(tmpdir(), "discord-mcp-"));
  await mkdir(join(dir, "root"));
  await writeFile(join(dir, "root", "file.txt"), "hello webhook");
  return dir;
}

it("executes a webhook, fetching token first and sending wait=true without auth header", async () => {
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
    name: "discord_execute_webhook",
    arguments: {
      webhook_id: "101",
      content: "Hello from webhook!",
      username: "Custom Bot",
      avatar_url: "https://example.com/avatar.png",
      tts: false,
      thread_id: "401",
    },
  });

  expect(result.structuredContent).toEqual({ message: MESSAGE });
  expect(makeRequest).toHaveBeenCalledTimes(2);

  // Request 0 is the token fetch (bot credential with Authorization)
  expect(request(0).method).toBe("GET");
  expect(request(0).url).toBe("https://discord.com/api/v10/webhooks/101");
  expect(new Headers(request(0).headers as HeadersInit).get("authorization")).toBe(
    "Bot test-token",
  );

  // Request 1 is the execute call (token route, no Authorization, query wait=true&thread_id=401)
  const req = request(1);
  expect(req.method).toBe("POST");
  expect(req.url).toBe(
    "https://discord.com/api/v10/webhooks/101/my-secret-webhook-token?wait=true&thread_id=401",
  );
  expect(new Headers(req.headers as HeadersInit).has("authorization")).toBe(false);
  expect(JSON.parse(String(req.body))).toEqual({
    content: "Hello from webhook!",
    username: "Custom Bot",
    avatar_url: "https://example.com/avatar.png",
    tts: false,
    allowed_mentions: { parse: [] },
    attachments: [],
  });
});

it("sends all supported message fields (embeds, poll, flags, thread_name, applied_tags)", async () => {
  const { client, request, makeRequest } = await harness({
    policy: new PPolicyEngine([], ["webhooks"], false),
    makeRequest: async (url) => {
      if (String(url).endsWith("/webhooks/101")) {
        return json(WEBHOOK);
      }
      return json(MESSAGE);
    },
  });

  const samplePoll = {
    question: { text: "Favorite color?" },
    answers: [{ poll_media: { text: "Blue" } }, { poll_media: { text: "Red" } }],
  };

  const result = await client.callTool({
    name: "discord_execute_webhook",
    arguments: {
      webhook_id: "101",
      content: "All fields test",
      username: "Special Bot",
      avatar_url: "https://example.com/avatar2.png",
      tts: true,
      flags: 4,
      thread_name: "New Forum Post",
      applied_tags: ["501", "502"],
      embeds: [{ title: "Embed 1" }],
      poll: samplePoll,
    },
  });

  expect(result.structuredContent).toEqual({ message: MESSAGE });
  expect(makeRequest).toHaveBeenCalledTimes(2);

  const req = request(1);
  expect(req.method).toBe("POST");
  expect(req.url).toBe(
    "https://discord.com/api/v10/webhooks/101/my-secret-webhook-token?wait=true",
  );
  expect(JSON.parse(String(req.body))).toEqual({
    content: "All fields test",
    username: "Special Bot",
    avatar_url: "https://example.com/avatar2.png",
    tts: true,
    flags: 4,
    thread_name: "New Forum Post",
    applied_tags: ["501", "502"],
    embeds: [{ title: "Embed 1" }],
    poll: samplePoll,
    allowed_mentions: { parse: [] },
    attachments: [],
  });
});

it("rejects invalid flags bitfield", async () => {
  const { client, makeRequest } = await harness({
    policy: new PPolicyEngine([], ["webhooks"], false),
  });

  const result = await client.callTool({
    name: "discord_execute_webhook",
    arguments: {
      webhook_id: "101",
      content: "Bad flags",
      flags: 2,
    },
  });

  expect(errorOf(result)).toMatchObject({
    category: "validation",
  });
  expect(makeRequest).not.toHaveBeenCalled();
});

it("rejects more than 5 applied_tags", async () => {
  const { client, makeRequest } = await harness({
    policy: new PPolicyEngine([], ["webhooks"], false),
  });

  const result = await client.callTool({
    name: "discord_execute_webhook",
    arguments: {
      webhook_id: "101",
      content: "Too many tags",
      applied_tags: ["1", "2", "3", "4", "5", "6"],
    },
  });

  expect(errorOf(result)).toMatchObject({
    category: "validation",
  });
  expect(makeRequest).not.toHaveBeenCalled();
});

it("uploads attachments using multipart form-data without auth header", async () => {
  const dir = await tempDir();
  const { client, request } = await harness({
    policy: new PPolicyEngine([], ["webhooks"], false),
    files: new PAttachmentService([join(dir, "root")], ""),
    makeRequest: async (url) => {
      if (String(url).endsWith("/webhooks/101")) {
        return json(WEBHOOK);
      }
      return json(MESSAGE);
    },
  });

  await client.callTool({
    name: "discord_execute_webhook",
    arguments: {
      webhook_id: "101",
      content: "Here is a file",
      files: [{ path: join(dir, "root", "file.txt"), description: "test doc" }],
    },
  });

  const req = request(1);
  expect(req.method).toBe("POST");
  expect(new Headers(req.headers as HeadersInit).has("authorization")).toBe(false);
  const form = req.body as FormData;
  const payloadJson = JSON.parse(String(form.get("payload_json")));
  expect(payloadJson.content).toBe("Here is a file");
  expect(payloadJson.attachments).toEqual([
    { id: "0", filename: "file.txt", description: "test doc" },
  ]);
  expect(form.get("files[0]")).toBeDefined();
});

it("fails with validation error when webhook has no token", async () => {
  const { client } = await harness({
    policy: new PPolicyEngine([], ["webhooks"], false),
    makeRequest: async (url) => {
      if (String(url).endsWith("/webhooks/101")) {
        return json({ id: "101", guild_id: "201", type: 2 }); // follower webhook, no token
      }
      return json(MESSAGE);
    },
  });

  const result = await client.callTool({
    name: "discord_execute_webhook",
    arguments: {
      webhook_id: "101",
      content: "Hello",
    },
  });

  expect(errorOf(result)).toMatchObject({
    category: "validation",
    retryable: false,
    message: "Webhook has no token",
    remediation: "Only incoming webhooks can post; create one with discord_create_webhook",
  });
});

it("masks token in error message when execute webhook fails", async () => {
  const secretToken = "my-webhook-secret-token";
  const { client } = await harness({
    policy: new PPolicyEngine([], ["webhooks"], false),
    makeRequest: async (url) => {
      if (String(url).endsWith("/webhooks/101")) {
        return json({ id: "101", guild_id: "201", token: secretToken });
      }
      return json(
        { message: `Invalid webhook token at /webhooks/101/${secretToken}`, code: 50027 },
        { status: 401 },
      );
    },
  });

  const result = await client.callTool({
    name: "discord_execute_webhook",
    arguments: {
      webhook_id: "101",
      content: "Hello",
    },
  });

  const error = errorOf(result);
  const errorText = JSON.stringify(error);
  expect(errorText).not.toContain(secretToken);
  expect(errorText).toContain("/webhooks/101/[redacted]");
});

it("maps 403 to permission error with ManageWebhooks remediation", async () => {
  const { client } = await harness({
    policy: new PPolicyEngine([], ["webhooks"], false),
    makeRequest: async () => json({ message: "Missing Permissions", code: 50013 }, { status: 403 }),
  });

  const result = await client.callTool({
    name: "discord_execute_webhook",
    arguments: {
      webhook_id: "101",
      content: "Hello",
    },
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
    name: "discord_execute_webhook",
    arguments: {
      webhook_id: "101",
      content: "Hello",
    },
  });

  expect(errorOf(result)).toMatchObject({
    category: "not_found",
    status: 404,
    discord_code: 10015,
    remediation: "Check the IDs in the request",
  });
});

it("passes allowlist check when webhook guild is allowed", async () => {
  const { client, request, makeRequest } = await harness({
    policy: new PPolicyEngine(["201"], ["webhooks"], false),
    makeRequest: async (url) => {
      if (String(url).endsWith("/webhooks/101")) {
        return json(WEBHOOK);
      }
      return json(MESSAGE);
    },
  });

  const result = await client.callTool({
    name: "discord_execute_webhook",
    arguments: {
      webhook_id: "101",
      content: "Hello",
    },
  });

  expect(result.isError).toBeFalsy();
  expect(makeRequest).toHaveBeenCalledTimes(3);
  const finalReq = request(2);
  expect(finalReq.method).toBe("POST");
  expect(finalReq.url).toBe(
    "https://discord.com/api/v10/webhooks/101/my-secret-webhook-token?wait=true",
  );
});

it("denies access when webhook guild is not allowed", async () => {
  const { client, makeRequest } = await harness({
    policy: new PPolicyEngine(["999"], ["webhooks"], false),
    makeRequest: async () => json({ id: "101", guild_id: "201", token: "tok" }),
  });

  const result = await client.callTool({
    name: "discord_execute_webhook",
    arguments: {
      webhook_id: "101",
      content: "Hello",
    },
  });

  expect(errorOf(result)).toMatchObject({
    category: "policy",
    message: "Guild is not allowed",
  });
  expect(makeRequest).toHaveBeenCalledTimes(1);
});

it("blocks execution in read-only mode", async () => {
  const { client, makeRequest } = await harness({
    policy: new PPolicyEngine([], ["webhooks"], true),
  });

  const result = await client.callTool({
    name: "discord_execute_webhook",
    arguments: {
      webhook_id: "101",
      content: "Hello",
    },
  });

  expect(errorOf(result)).toMatchObject({
    category: "policy",
    message: "Read-only mode",
  });
  expect(makeRequest).not.toHaveBeenCalled();
});
