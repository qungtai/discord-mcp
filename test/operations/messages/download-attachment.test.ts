import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { PAttachmentService } from "../../../src/adapters/files/attachment-service.js";
import { errorOf, harness } from "../../support/harness.js";

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
const get = { channel_id: "1", message_id: "2" };

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

it("returns not_found for an unknown attachment", async () => {
  const { pipeline } = await harness({
    respond: () => ({ id: "2", channel_id: "1", attachments: [] }),
  });
  expect(
    await pipeline.call("discord_download_attachment", { ...get, attachment_id: "3" }),
  ).toMatchObject({
    ok: false,
    error: { category: "not_found", retryable: false, message: "Attachment not found" },
  });
});

it("binds the download to the call signal (n1)", async () => {
  class SpyFiles extends PAttachmentService {
    signal?: AbortSignal;
    override async download(_url: string, filename: string, signal?: AbortSignal) {
      this.signal = signal;
      return { path: filename, size: 5, sha256: "x" };
    }
  }
  const files = new SpyFiles([], "");
  const { pipeline } = await harness({ files });
  const controller = new AbortController();
  const result = await pipeline.call(
    "discord_download_attachment",
    { ...get, attachment_id: "11" },
    { signal: controller.signal },
  );
  expect(result.ok).toBe(true);
  expect(files.signal).toBe(controller.signal);
});
