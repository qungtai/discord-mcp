import { access, mkdir, mkdtemp, symlink, truncate, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PAttachmentService } from "../../src/adapters/files/attachment-service.js";

let dir: string;
let root: string;
beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "discord-mcp-"));
  root = join(dir, "root");
  await mkdir(root);
  await writeFile(join(root, "a.txt"), "hello");
  await writeFile(join(dir, "outside"), "secret");
});
afterEach(() => vi.unstubAllGlobals());

const rejects = (promise: Promise<unknown>, category: string, message: string) =>
  expect(promise).rejects.toMatchObject({
    name: "PToolError",
    category,
    retryable: false,
    message,
  });

describe("uploads", () => {
  it("reads a file inside a root", async () => {
    const file = await new PAttachmentService([root], "").upload(join(root, "a.txt"));
    expect([file.name, file.data.toString()]).toEqual(["a.txt", "hello"]);
  });
  it("rejects paths outside the roots, including sibling prefixes", async () => {
    await mkdir(`${root}2`);
    await writeFile(join(`${root}2`, "b.txt"), "x");
    const service = new PAttachmentService([root], "");
    await rejects(service.upload(join(dir, "outside")), "policy", "Upload outside allowed roots");
    await rejects(
      service.upload(join(`${root}2`, "b.txt")),
      "policy",
      "Upload outside allowed roots",
    );
  });
  it("rejects a symlink that escapes the root", async () => {
    await symlink(join(dir, "outside"), join(root, "link"));
    await rejects(
      new PAttachmentService([root], "").upload(join(root, "link")),
      "policy",
      "Upload outside allowed roots",
    );
  });
  it("rejects relative and traversal paths", async () => {
    const service = new PAttachmentService([root], "");
    await rejects(service.upload("a.txt"), "validation", "Invalid upload path");
    await rejects(service.upload(`${root}/../outside`), "validation", "Invalid upload path");
  });
  it("rejects files over the configured cap, 20 MiB by default", async () => {
    await writeFile(join(root, "big"), "");
    await truncate(join(root, "big"), 20 * 1024 * 1024 + 1);
    await rejects(
      new PAttachmentService([root], "").upload(join(root, "big")),
      "validation",
      "Upload must be a regular file of at most 20971520 bytes",
    );
    await rejects(
      new PAttachmentService([root], "", 4).upload(join(root, "a.txt")),
      "validation",
      "Upload must be a regular file of at most 4 bytes",
    );
  });
  it("does not reveal whether a path outside the roots exists", async () => {
    const service = new PAttachmentService([root], "");
    for (const path of [join(dir, "outside"), join(dir, "missing")])
      await rejects(service.upload(path), "policy", "Upload outside allowed roots");
  });
  it("reports a missing file as not_found", async () => {
    await rejects(
      new PAttachmentService([root], "").upload(join(root, "missing")),
      "not_found",
      "Upload file not found",
    );
  });
});

describe("downloads", () => {
  beforeEach(() =>
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("hello")),
    ),
  );
  it("rejects non-Discord URLs", async () => {
    await rejects(
      new PAttachmentService([], dir).download("https://evil.example/a", "x"),
      "validation",
      "Invalid attachment URL",
    );
  });
  it("rejects a missing download directory", async () => {
    await rejects(
      new PAttachmentService([], join(dir, "nope")).download("https://cdn.discordapp.com/a", "x"),
      "validation",
      "Download directory does not exist",
    );
  });
  it("rejects an unset download directory and path-like names", async () => {
    await rejects(
      new PAttachmentService([], "").download("https://cdn.discordapp.com/a", "x"),
      "validation",
      "Invalid download location",
    );
    await rejects(
      new PAttachmentService([], dir).download("https://cdn.discordapp.com/a", "../x"),
      "validation",
      "Invalid download location",
    );
  });
  it("refuses redirects", async () => {
    const fetch = vi.fn(async (_: URL, init?: RequestInit) =>
      init?.redirect === "error" ? new Response("ok") : new Response("", { status: 302 }),
    );
    vi.stubGlobal("fetch", fetch);
    await new PAttachmentService([], dir).download("https://cdn.discordapp.com/a", "r");
    expect(fetch.mock.calls[0]?.[1]).toMatchObject({ redirect: "error" });
  });
  it("maps non-OK responses to a retryable Discord error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("", { status: 503 })),
    );
    await expect(
      new PAttachmentService([], dir).download("https://cdn.discordapp.com/a", "x"),
    ).rejects.toMatchObject({ category: "discord", retryable: true, message: "Download failed" });
    await expect(access(join(dir, "x"))).rejects.toMatchObject({ code: "ENOENT" });
  });
  it("maps network failures and cancellation", async () => {
    const service = new PAttachmentService([], dir);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new TypeError("fetch failed");
      }),
    );
    await expect(service.download("https://cdn.discordapp.com/a", "y")).rejects.toMatchObject({
      category: "discord",
      retryable: true,
      message: "Download failed before a response",
    });
    const controller = new AbortController();
    controller.abort();
    await expect(
      service.download("https://cdn.discordapp.com/a", "z", controller.signal),
    ).rejects.toMatchObject({ category: "cancelled", message: "Download cancelled" });
  });
});
