import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PAttachmentService } from "../../../src/adapters/files/attachment-service.js";
import { PPolicyEngine } from "../../../src/core/policy.js";
import { harness, MESSAGE } from "../../support/harness.js";

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
    const result = await client.callTool({
      name: "discord_send_message",
      arguments: {
        channel_id: "1",
        content: "hello",
        files: [{ path: join(dir, "root", "a.txt"), description: "alt", is_spoiler: true }],
      },
    });
    expect(result.structuredContent).toEqual({ message: MESSAGE });
    const { url, method, body } = request();
    expect([method, url]).toEqual(["POST", "https://discord.com/api/v10/channels/1/messages"]);
    const form = body as FormData;
    const payload = JSON.parse(String(form.get("payload_json")));
    expect(payload).toEqual({
      nonce: expect.stringMatching(/^[a-f0-9]{24}$/),
      enforce_nonce: true,
      content: "hello",
      allowed_mentions: { parse: [] },
      attachments: [{ id: "0", filename: "a.txt", description: "alt", is_spoiler: true }],
    });
    expect(await (form.get("files[0]") as Blob).text()).toBe("hello");
  });

  it("edits attachment metadata with is_spoiler and keeps unchanged attachments", async () => {
    const { client, request } = await harness();
    await client.callTool({
      name: "discord_edit_message",
      arguments: {
        channel_id: "1",
        message_id: "2",
        update_attachments: [{ id: "11", description: "new", is_spoiler: true }],
      },
    });
    expect(request(0).method).toBe("GET");
    expect(request(1).method).toBe("PATCH");
    expect(JSON.parse(String(request(1).body))).toEqual({
      attachments: [{ id: "11", description: "new", is_spoiler: true }, { id: "12" }],
    });
  });

  it("does not touch attachments when only the content changes", async () => {
    const { client, request, makeRequest } = await harness();
    await client.callTool({
      name: "discord_edit_message",
      arguments: { channel_id: "1", message_id: "2", content: "change" },
    });
    expect(makeRequest).toHaveBeenCalledTimes(1);
    expect(JSON.parse(String(request().body))).toEqual({ content: "change" });
  });

  it("rejects attachment removal until approval exists without calling Discord", async () => {
    const { client, makeRequest } = await harness();
    const result = await client.callTool({
      name: "discord_edit_message",
      arguments: { channel_id: "1", message_id: "2", remove_attachment_ids: ["11"] },
    });
    expect(result.isError).toBe(true);
    expect(result.structuredContent).toMatchObject({
      error: { category: "policy", message: "Attachment removal requires approval support" },
    });
    expect(makeRequest).not.toHaveBeenCalled();
  });

  it("lists messages with the query parameters and returns them", async () => {
    const { client, request } = await harness({ respond: () => [MESSAGE] });
    const result = await client.callTool({
      name: "discord_list_messages",
      arguments: { channel_id: "1", limit: 3, before: "4" },
    });
    expect(request().url).toBe("https://discord.com/api/v10/channels/1/messages?limit=3&before=4");
    expect(result.structuredContent).toEqual({ messages: [MESSAGE] });
  });

  it("downloads to a collision-free name with metadata and refuses to overwrite", async () => {
    const dir = await tempDir();
    const downloads = join(dir, "downloads");
    const { client } = await harness({ files: new PAttachmentService([], downloads) });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("hello")),
    );
    const call = () =>
      client.callTool({
        name: "discord_download_attachment",
        arguments: { channel_id: "1", message_id: "2", attachment_id: "11" },
      });
    const first = await call();
    expect(first.structuredContent).toEqual({
      path: join(downloads, "2-11-one.png"),
      filename: "2-11-one.png",
      size: 5,
      content_type: "image/png",
      sha256: "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824",
    });
    expect(await readFile(join(downloads, "2-11-one.png"), "utf8")).toBe("hello");
    expect((await call()).structuredContent).toMatchObject({
      error: { category: "conflict", retryable: false, message: "Download already exists" },
    });
  });

  it("blocks mutating tools in read-only mode before any request", async () => {
    const { client, makeRequest } = await harness({
      policy: new PPolicyEngine([], ["core", "messages"], true),
    });
    const result = await client.callTool({
      name: "discord_send_message",
      arguments: { channel_id: "1", content: "x" },
    });
    expect(result.structuredContent).toMatchObject({
      error: { category: "policy", message: "Read-only mode", retryable: false },
    });
    expect(makeRequest).not.toHaveBeenCalled();
  });

  it("blocks guilds outside the allowlist before calling the tool", async () => {
    const { client, makeRequest } = await harness({
      policy: new PPolicyEngine(["200"], ["core", "messages"], false),
    });
    const result = await client.callTool({
      name: "discord_get_message",
      arguments: { channel_id: "1", message_id: "2" },
    });
    expect(result.structuredContent).toMatchObject({
      error: { category: "policy", message: "Guild is not allowed" },
    });
    expect(makeRequest).not.toHaveBeenCalled();
  });
});
