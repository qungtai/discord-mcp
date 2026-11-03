import {
  access,
  mkdir,
  mkdtemp,
  readFile,
  realpath,
  symlink,
  truncate,
  writeFile,
} from "node:fs/promises";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  defaultDownloadDir,
  PAttachmentService,
} from "../../src/adapters/files/attachment-service.js";

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
  it("accepts the canonical path of a root configured through a symlink (n3)", async () => {
    await symlink(root, join(dir, "alias"));
    const file = await new PAttachmentService([join(dir, "alias")], "").upload(
      join(await realpath(root), "a.txt"),
    );
    expect(file.data.toString()).toBe("hello");
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
  it("skips a missing root (F4)", async () => {
    const file = await new PAttachmentService([join(dir, "gone"), root], "").upload(
      join(root, "a.txt"),
    );
    expect(file.name).toBe("a.txt");
    await rejects(
      new PAttachmentService([join(dir, "gone")], "").upload(join(dir, "gone", "a.txt")),
      "not_found",
      "Upload file not found",
    );
  });
  it("reports a missing file as not_found", async () => {
    await rejects(
      new PAttachmentService([root], "").upload(join(root, "missing")),
      "not_found",
      "Upload file not found",
    );
  });
  it("allows a file in a temp folder by default", async () => {
    const file = await new PAttachmentService([], "").upload(join(root, "a.txt"));
    expect([file.name, file.data.toString()]).toEqual(["a.txt", "hello"]);
  });
  it("refuses a nonexistent hidden path with policy error before existence check", async () => {
    await rejects(
      new PAttachmentService([], "").upload(join(dir, ".nope")),
      "policy",
      "Hidden files and folders are not uploaded by default",
    );
  });
  it("refuses a hidden file by default", async () => {
    await writeFile(join(dir, ".secret"), "secret");
    await expect(new PAttachmentService([], "").upload(join(dir, ".secret"))).rejects.toMatchObject(
      {
        name: "PToolError",
        category: "policy",
        retryable: false,
        message: "Hidden files and folders are not uploaded by default",
        remediation: "Set DISCORD_MCP_FILE_ROOTS to a folder that contains the file to allow it",
      },
    );
  });
  it("refuses a file inside a hidden folder by default", async () => {
    const hiddenDir = join(dir, ".hidden");
    await mkdir(hiddenDir);
    await writeFile(join(hiddenDir, "file.txt"), "hidden content");
    await rejects(
      new PAttachmentService([], "").upload(join(hiddenDir, "file.txt")),
      "policy",
      "Hidden files and folders are not uploaded by default",
    );
  });
  it("refuses a symlink in a normal folder pointing at a hidden target by default", async () => {
    await writeFile(join(dir, ".target"), "hidden target");
    const linkPath = join(root, "link-to-hidden");
    await symlink(join(dir, ".target"), linkPath);
    await rejects(
      new PAttachmentService([], "").upload(linkPath),
      "policy",
      "Hidden files and folders are not uploaded by default",
    );
  });
  it("refuses a directory symlink to a hidden folder by default", async () => {
    const hiddenDir = join(dir, ".hidden-dir");
    await mkdir(hiddenDir);
    await writeFile(join(hiddenDir, "sub.txt"), "sub content");
    const linkDir = join(root, "link-dir");
    await symlink(hiddenDir, linkDir);
    await rejects(
      new PAttachmentService([], "").upload(join(linkDir, "sub.txt")),
      "policy",
      "Hidden files and folders are not uploaded by default",
    );
  });
  it("uploads under target basename when symlink points to a normal file by default", async () => {
    const targetFile = join(dir, "target.txt");
    await writeFile(targetFile, "target content");
    const linkPath = join(root, "link-to-target");
    await symlink(targetFile, linkPath);
    const file = await new PAttachmentService([], "").upload(linkPath);
    expect([file.name, file.data.toString()]).toEqual(["target.txt", "target content"]);
  });
  it("enforces size limit, regular file check, and missing file in default mode", async () => {
    const service = new PAttachmentService([], "", 10);
    const bigPath = join(root, "big.txt");
    await writeFile(bigPath, "123456789012345");
    await rejects(
      service.upload(bigPath),
      "validation",
      "Upload must be a regular file of at most 10 bytes",
    );
    await rejects(
      service.upload(root),
      "validation",
      "Upload must be a regular file of at most 10 bytes",
    );
    await rejects(
      service.upload(join(root, "nonexistent.txt")),
      "not_found",
      "Upload file not found",
    );
  });
  it("allows hidden files when configured roots contain them", async () => {
    const hiddenDir = join(dir, ".allowed-hidden");
    await mkdir(hiddenDir);
    await writeFile(join(hiddenDir, "file.txt"), "inside root");
    const file = await new PAttachmentService([hiddenDir], "").upload(join(hiddenDir, "file.txt"));
    expect([file.name, file.data.toString()]).toEqual(["file.txt", "inside root"]);
  });
  it("refuses paths under /proc, /sys, or /dev in default mode", async () => {
    const service = new PAttachmentService([], "");
    for (const sysPath of ["/proc/version", "/sys/class", "/dev/null"]) {
      await rejects(
        service.upload(sysPath),
        "policy",
        "Hidden files and folders are not uploaded by default",
      );
    }
  });
  it("refuses a symlink pointing to /proc, /sys, or /dev in default mode", async () => {
    const service = new PAttachmentService([], "");
    const linkPath = join(root, "link-to-dev");
    await symlink("/dev/null", linkPath);
    await rejects(
      service.upload(linkPath),
      "policy",
      "Hidden files and folders are not uploaded by default",
    );
  });
  it("refuses an upload whose bytes contain the configured bot token in default and roots modes", async () => {
    const fakeToken = "secret-token-12345";
    const tokenFile = join(root, "with-token.txt");
    await writeFile(tokenFile, `config: DISCORD_TOKEN=${fakeToken}\nother stuff`);

    const defaultService = new PAttachmentService([], "", undefined, fakeToken);
    await rejects(defaultService.upload(tokenFile), "policy", "File contains the bot token");
    await expect(defaultService.upload(tokenFile)).rejects.toMatchObject({
      name: "PToolError",
      category: "policy",
      retryable: false,
      message: "File contains the bot token",
      remediation: "Remove the bot token from the file before uploading",
    });

    const rootsService = new PAttachmentService([root], "", undefined, fakeToken);
    await rejects(rootsService.upload(tokenFile), "policy", "File contains the bot token");

    // Clean file without token succeeds
    const cleanFile = join(root, "clean.txt");
    await writeFile(cleanFile, "safe content");
    const uploaded = await defaultService.upload(cleanFile);
    expect(uploaded.data.toString()).toBe("safe content");
  });
  it("returns distinct error instances from hidden file refusal", async () => {
    const service = new PAttachmentService([], "");
    let err1: unknown;
    let err2: unknown;
    try {
      await service.upload(join(dir, ".secret1"));
    } catch (e) {
      err1 = e;
    }
    try {
      await service.upload(join(dir, ".secret2"));
    } catch (e) {
      err2 = e;
    }
    expect(err1).not.toBe(err2);
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
  it("creates the download directory recursively on first download", async () => {
    const freshDir = join(dir, "fresh", "nested");
    const result = await new PAttachmentService([], freshDir).download(
      "https://cdn.discordapp.com/a",
      "x.png",
    );
    expect(result.path).toBe(join(freshDir, "x.png"));
    expect(await readFile(join(freshDir, "x.png"), "utf8")).toBe("hello");
  });
  it("uses and creates the default download dir when unset (pointing homedir at temp)", async () => {
    const fakeHome = join(dir, "home");
    await mkdir(fakeHome);
    const origHome = process.env.HOME;
    const origUserProfile = process.env.USERPROFILE;
    try {
      process.env.HOME = fakeHome;
      process.env.USERPROFILE = fakeHome;
      expect(homedir()).toBe(fakeHome);
      const expectedDir = join(fakeHome, "Downloads", "discord-mcp");
      expect(defaultDownloadDir()).toBe(expectedDir);
      const service = new PAttachmentService([], defaultDownloadDir());
      const result = await service.download("https://cdn.discordapp.com/a", "default.png");
      expect(result.path).toBe(join(expectedDir, "default.png"));
      expect(await readFile(join(expectedDir, "default.png"), "utf8")).toBe("hello");
    } finally {
      if (origHome !== undefined) process.env.HOME = origHome;
      else delete process.env.HOME;
      if (origUserProfile !== undefined) process.env.USERPROFILE = origUserProfile;
      else delete process.env.USERPROFILE;
    }
  });
  it("maps mkdir failure to a validation error when creating download directory", async () => {
    const filePath = join(dir, "blocked-file");
    await writeFile(filePath, "not a directory");
    const blockedDownloadDir = join(filePath, "nested");
    await rejects(
      new PAttachmentService([], blockedDownloadDir).download("https://cdn.discordapp.com/a", "x"),
      "validation",
      "Download directory cannot be created",
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
