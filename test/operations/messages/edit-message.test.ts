import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { PAttachmentService } from "../../../src/adapters/files/attachment-service.js";
import { errorOf, harness, MESSAGE } from "../../support/harness.js";

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
