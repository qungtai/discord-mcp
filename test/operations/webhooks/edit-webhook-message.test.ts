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
  await writeFile(join(dir, "root", "new.txt"), "updated file content");
  return dir;
}

it("edits webhook message content and embeds with approval and without auth header", async () => {
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
    name: "discord_edit_webhook_message",
    arguments: {
      webhook_id: "101",
      message_id: "501",
      content: "Edited webhook message",
      thread_id: "401",
    },
  });

  expect(result.structuredContent).toEqual({ message: MESSAGE });
  expect(makeRequest).toHaveBeenCalledTimes(2);

  // Request 0 is token lookup
  expect(request(0).method).toBe("GET");
  expect(request(0).url).toBe("https://discord.com/api/v10/webhooks/101");

  // Request 1 is PATCH message without auth header
  const req = request(1);
  expect(req.method).toBe("PATCH");
  expect(req.url).toBe(
    "https://discord.com/api/v10/webhooks/101/my-secret-webhook-token/messages/501?thread_id=401",
  );
  expect(new Headers(req.headers as HeadersInit).has("authorization")).toBe(false);
  expect(JSON.parse(String(req.body))).toEqual({
    content: "Edited webhook message",
    allowed_mentions: { parse: [] },
  });
});

it("merges attachments and updates attachment metadata", async () => {
  const dir = await tempDir();
  const { client, request } = await harness({
    policy: new PPolicyEngine([], ["webhooks"], false),
    files: new PAttachmentService([join(dir, "root")], ""),
    makeRequest: async (url, init) => {
      if (String(url).endsWith("/webhooks/101")) {
        return json(WEBHOOK);
      }
      if (init?.method === "GET") {
        return json(MESSAGE);
      }
      return json(MESSAGE);
    },
  });

  await client.callTool({
    name: "discord_edit_webhook_message",
    arguments: {
      webhook_id: "101",
      message_id: "501",
      add_files: [{ path: join(dir, "root", "new.txt") }],
      update_attachments: [{ id: "11", description: "updated description", is_spoiler: true }],
      thread_id: "401",
    },
  });

  // Request 0 is token lookup (GET)
  expect(request(0).method).toBe("GET");
  expect(request(0).url).toBe("https://discord.com/api/v10/webhooks/101");

  // Request 1 is existing message lookup (GET) with thread_id
  expect(request(1).method).toBe("GET");
  expect(request(1).url).toBe(
    "https://discord.com/api/v10/webhooks/101/my-secret-webhook-token/messages/501?thread_id=401",
  );
  expect(new Headers(request(1).headers as HeadersInit).has("authorization")).toBe(false);

  // Request 2 is PATCH with multipart
  const req = request(2);
  expect(req.method).toBe("PATCH");
  expect(req.url).toBe(
    "https://discord.com/api/v10/webhooks/101/my-secret-webhook-token/messages/501?thread_id=401",
  );
  expect(new Headers(req.headers as HeadersInit).has("authorization")).toBe(false);
  const form = req.body as FormData;
  const payload = JSON.parse(String(form.get("payload_json")));
  expect(payload.attachments).toEqual([
    { id: "11", description: "updated description", is_spoiler: true },
    { id: "12" },
    { id: "0", filename: "new.txt" },
  ]);
});

it("passes allowlist check when both webhook and thread guilds are allowed", async () => {
  const { client, request, makeRequest } = await harness({
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
    name: "discord_edit_webhook_message",
    arguments: {
      webhook_id: "101",
      message_id: "501",
      content: "Edited",
      thread_id: "401",
    },
  });

  expect(result.isError).toBeFalsy();
  expect(makeRequest).toHaveBeenCalledTimes(4);
  const finalReq = request(3);
  expect(finalReq.method).toBe("PATCH");
  expect(finalReq.url).toBe(
    "https://discord.com/api/v10/webhooks/101/my-secret-webhook-token/messages/501?thread_id=401",
  );
});

it("denies access when thread belongs to a disallowed guild", async () => {
  const { client, makeRequest } = await harness({
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
    name: "discord_edit_webhook_message",
    arguments: {
      webhook_id: "101",
      message_id: "501",
      content: "Edited",
      thread_id: "401",
    },
  });

  expect(errorOf(result)).toMatchObject({
    category: "policy",
    message: "Guild is not allowed",
  });
  expect(makeRequest).toHaveBeenCalledTimes(2);
});

it("maps 403 to permission error with ManageWebhooks remediation", async () => {
  const { client } = await harness({
    policy: new PPolicyEngine([], ["webhooks"], false),
    makeRequest: async () => json({ message: "Missing Permissions", code: 50013 }, { status: 403 }),
  });

  const result = await client.callTool({
    name: "discord_edit_webhook_message",
    arguments: {
      webhook_id: "101",
      message_id: "501",
      content: "Edited",
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
    makeRequest: async (url) => {
      if (String(url).endsWith("/webhooks/101")) {
        return json(WEBHOOK);
      }
      return json({ message: "Unknown Message", code: 10008 }, { status: 404 });
    },
  });

  const result = await client.callTool({
    name: "discord_edit_webhook_message",
    arguments: {
      webhook_id: "101",
      message_id: "501",
      content: "Edited",
    },
  });

  expect(errorOf(result)).toMatchObject({
    category: "not_found",
    status: 404,
    discord_code: 10008,
    remediation: "Check the IDs in the request",
  });
});

it("blocks mutating call in read-only mode", async () => {
  const { client, makeRequest } = await harness({
    policy: new PPolicyEngine([], ["webhooks"], true),
  });

  const result = await client.callTool({
    name: "discord_edit_webhook_message",
    arguments: {
      webhook_id: "101",
      message_id: "501",
      content: "Edited",
    },
  });

  expect(errorOf(result)).toMatchObject({
    category: "policy",
    message: "Read-only mode",
  });
  expect(makeRequest).not.toHaveBeenCalled();
});
