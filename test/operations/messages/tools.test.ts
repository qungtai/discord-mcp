import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PAttachmentService } from "../../../src/adapters/files/attachment-service.js";
import { PPolicyEngine } from "../../../src/core/policy.js";
import { errorOf, harness, MESSAGE } from "../../support/harness.js";

afterEach(() => vi.unstubAllGlobals());

async function tempDir() {
  const dir = await mkdtemp(join(tmpdir(), "discord-mcp-"));
  await mkdir(join(dir, "root"));
  await mkdir(join(dir, "downloads"));
  await writeFile(join(dir, "root", "a.txt"), "hello");
  return dir;
}

describe("message tools over MCP", () => {
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
    expect(onprogress.mock.calls).toEqual([
      [{ progress: 0, total: 1 }],
      [{ progress: 1, total: 1 }],
    ]);
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

  it("edits attachment metadata, keeps the others and returns the message", async () => {
    const { client, request } = await harness();
    const result = await client.callTool({
      name: "discord_edit_message",
      arguments: {
        channel_id: "1",
        message_id: "2",
        update_attachments: [{ id: "11", description: "new", is_spoiler: true }],
      },
    });
    expect(result.structuredContent).toEqual({ message: MESSAGE });
    expect(request(0).method).toBe("GET");
    expect(request(1).method).toBe("PATCH");
    expect(JSON.parse(String(request(1).body))).toEqual({
      allowed_mentions: { parse: [] },
      attachments: [{ id: "11", description: "new", is_spoiler: true }, { id: "12" }],
    });
  });

  it("keeps the spoiler on an attachment it does not change", async () => {
    const spoiler = { ...MESSAGE.attachments[1], flags: 8 };
    const { client, request } = await harness({
      respond: () => ({ ...MESSAGE, attachments: [MESSAGE.attachments[0], spoiler] }),
    });
    await client.callTool({
      name: "discord_edit_message",
      arguments: {
        channel_id: "1",
        message_id: "2",
        update_attachments: [{ id: "11", description: "new" }],
      },
    });
    expect(JSON.parse(String(request(1).body)).attachments).toEqual([
      { id: "11", description: "new" },
      { id: "12", is_spoiler: true },
    ]);
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

  it("appends new files after the existing attachments", async () => {
    const dir = await tempDir();
    const { client, request } = await harness({
      files: new PAttachmentService([join(dir, "root")], ""),
    });
    await client.callTool({
      name: "discord_edit_message",
      arguments: {
        channel_id: "1",
        message_id: "2",
        add_files: [{ path: join(dir, "root", "a.txt") }],
      },
    });
    const form = request(1).body as FormData;
    expect(JSON.parse(String(form.get("payload_json"))).attachments).toEqual([
      { id: "11", description: "old" },
      { id: "12" },
      { id: "0", filename: "a.txt" },
    ]);
  });

  it("rejects an update for an unknown attachment before the PATCH", async () => {
    const { client, makeRequest } = await harness();
    const result = await client.callTool({
      name: "discord_edit_message",
      arguments: { channel_id: "1", message_id: "2", update_attachments: [{ id: "99" }] },
    });
    expect(errorOf(result)).toMatchObject({
      category: "not_found",
      message: "Unknown attachment",
      resource_ids: { channel_id: "1", message_id: "2", attachment_id: "99" },
    });
    expect(makeRequest).toHaveBeenCalledTimes(1);
  });

  it("does not touch attachments when only the content changes", async () => {
    const { client, request, makeRequest } = await harness();
    const result = await client.callTool({
      name: "discord_edit_message",
      arguments: { channel_id: "1", message_id: "2", content: "change" },
    });
    expect(result.structuredContent).toEqual({ message: MESSAGE });
    expect(makeRequest).toHaveBeenCalledTimes(1);
    expect(JSON.parse(String(request().body))).toEqual({
      content: "change",
      allowed_mentions: { parse: [] },
    });
  });

  it("lists messages with the query parameters and paging cursors", async () => {
    const older = { ...MESSAGE, id: "1" };
    const { client, request } = await harness({ respond: () => [MESSAGE, older] });
    const result = await client.callTool({
      name: "discord_list_messages",
      arguments: { channel_id: "1", limit: 3, before: "4" },
    });
    expect(request().url).toBe("https://discord.com/api/v10/channels/1/messages?limit=3&before=4");
    expect(result.structuredContent).toEqual({
      messages: [MESSAGE, older],
      next_before: "1",
      next_after: "2",
    });
  });

  it("downloads to a collision-free name with metadata and refuses to overwrite", async () => {
    const dir = await tempDir();
    const downloads = join(dir, "downloads");
    const { client } = await harness({ files: new PAttachmentService([], downloads) });
    const fetch = vi.fn(async () => new Response("hello"));
    vi.stubGlobal("fetch", fetch);
    const call = () =>
      client.callTool({
        name: "discord_download_attachment",
        arguments: { channel_id: "1", message_id: "2", attachment_id: "11" },
      });
    expect((await call()).structuredContent).toEqual({
      path: join(downloads, "2-11-one.png"),
      attachment_id: "11",
      filename: "2-11-one.png",
      size: 5,
      content_type: "image/png",
      sha256: "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824",
    });
    expect(await readFile(join(downloads, "2-11-one.png"), "utf8")).toBe("hello");
    expect(errorOf(await call())).toMatchObject({
      category: "conflict",
      retryable: false,
      message: "Download already exists",
    });
    expect(fetch).toHaveBeenCalledTimes(1);
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
});
