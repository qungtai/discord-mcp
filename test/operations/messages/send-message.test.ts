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

async function tempDir() {
  const dir = await mkdtemp(join(tmpdir(), "discord-mcp-"));
  await mkdir(join(dir, "root"));
  await mkdir(join(dir, "downloads"));
  await writeFile(join(dir, "root", "a.txt"), "hello");
  return dir;
}

it("sends a message with a nonce, no default mentions and multipart attachment metadata", async () => {
  const dir = await tempDir();
  const { client, request } = await harness({
    files: new PAttachmentService([join(dir, "root")], ""),
  });
  const onprogress = vi.fn();
  const result = await client.callTool(
    {
      name: "discord_send_message",
      arguments: {
        channel_id: "1",
        content: "hello",
        files: [
          {
            path: join(dir, "root", "a.txt"),
            description: "alt",
            title: "greeting",
            is_spoiler: true,
            content_type: "text/plain",
          },
        ],
      },
    },
    undefined,
    { onprogress },
  );
  expect(onprogress.mock.calls).toEqual([[{ progress: 0, total: 1 }], [{ progress: 1, total: 1 }]]);
  expect(result.structuredContent).toEqual({ message: MESSAGE });
  const { url, method, body } = request();
  expect([method, url]).toEqual(["POST", "https://discord.com/api/v10/channels/1/messages"]);
  const form = body as FormData;
  expect(JSON.parse(String(form.get("payload_json")))).toEqual({
    nonce: expect.stringMatching(/^[a-f0-9]{24}$/),
    enforce_nonce: true,
    content: "hello",
    allowed_mentions: { parse: [] },
    attachments: [
      { id: "0", filename: "a.txt", description: "alt", title: "greeting", is_spoiler: true },
    ],
  });
  const part = form.get("files[0]") as Blob;
  expect([await part.text(), part.type]).toEqual(["hello", "text/plain"]);
});

it("sends a caller-supplied nonce so a retry deduplicates", async () => {
  const { client, request } = await harness();
  await client.callTool({
    name: "discord_send_message",
    arguments: { channel_id: "1", content: "hi", nonce: "retry-1" },
  });
  expect(JSON.parse(String(request().body))).toMatchObject({
    nonce: "retry-1",
    enforce_nonce: true,
  });
});

it("rejects misspelled keys in nested objects", async () => {
  const { client, makeRequest } = await harness();
  const result = await client.callTool({
    name: "discord_send_message",
    arguments: { channel_id: "1", content: "x", allowed_mentions: { pars: ["users"] } },
  });
  expect(errorOf(result)).toMatchObject({ category: "validation" });
  expect(makeRequest).not.toHaveBeenCalled();
});

it("blocks guilds outside the allowlist before calling the tool", async () => {
  const { client, makeRequest } = await harness({
    policy: new PPolicyEngine(["200"], ["core", "messages"], false),
    respond: () => ({ id: "1", guild_id: "300" }),
  });
  const result = await client.callTool({
    name: "discord_send_message",
    arguments: { channel_id: "1", content: "x" },
  });
  expect(errorOf(result)).toMatchObject({ category: "policy", message: "Guild is not allowed" });
  expect(makeRequest).toHaveBeenCalledTimes(1);
});

it("does not replay a failed send and returns its nonce for a deduplicated retry", async () => {
  const { pipeline, makeRequest } = await harness({
    makeRequest: async () => json({}, { status: 502 }),
  });
  const result = await pipeline.call("discord_send_message", { channel_id: "1", content: "hello" });
  expect(makeRequest).toHaveBeenCalledTimes(1);
  if (result.ok) throw new Error("Expected uncertain result");
  expect(result.error).toMatchObject({
    category: "uncertain",
    retryable: false,
    remediation: "Check the result before retrying, or retry with the same nonce",
    resource_ids: { channel_id: "1", nonce: expect.stringMatching(/^[a-f0-9]{24}$/) },
  });
  const body = JSON.parse(String(makeRequest.mock.calls[0]?.[1]?.body));
  expect(body.nonce).toBe(result.error.resource_ids.nonce);
});

it("logs the redacted cause of a Discord failure", async () => {
  const { pipeline } = await harness({ makeRequest: async () => json({}, { status: 502 }) });
  await pipeline.call("discord_send_message", { channel_id: "1", content: "hello" });
  const written = vi
    .mocked(process.stderr.write)
    .mock.calls.map(([c]) => String(c))
    .join("");
  expect(written).toMatch(
    /uncertain: The write may have been applied \(cause: PToolError: Discord request failed \(HTTP 502\) <- HTTPError/,
  );
});

it("returns Discord's field errors for a 400", async () => {
  const { pipeline } = await harness({
    makeRequest: async () =>
      json(
        {
          message: "Invalid Form Body",
          code: 50035,
          errors: {
            content: {
              _errors: [
                { code: "BASE_TYPE_MAX_LENGTH", message: "Must be 2000 or fewer in length." },
              ],
            },
          },
        },
        { status: 400 },
      ),
  });
  expect(
    await pipeline.call("discord_send_message", { channel_id: "1", content: "x" }),
  ).toMatchObject({
    error: {
      category: "validation",
      retryable: false,
      discord_code: 50035,
      message:
        "Discord rejected the request (HTTP 400): Invalid Form Body\ncontent[BASE_TYPE_MAX_LENGTH]: Must be 2000 or fewer in length.",
    },
  });
});

it("blocks mutating tools in read-only mode and uploads outside the roots", async () => {
  const readOnly = await harness({ policy: new PPolicyEngine([], ["messages"], true) });
  expect(
    await readOnly.pipeline.call("discord_send_message", { channel_id: "1", content: "x" }),
  ).toMatchObject({ error: { category: "policy", message: "Read-only mode" } });
  const { pipeline, makeRequest } = await harness();
  expect(
    await pipeline.call("discord_send_message", {
      channel_id: "1",
      files: [{ path: "/etc/hosts" }],
    }),
  ).toMatchObject({ ok: false, error: { category: "policy", retryable: false } });
  expect(makeRequest).not.toHaveBeenCalled();
});
