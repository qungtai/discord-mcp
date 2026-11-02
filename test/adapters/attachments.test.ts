import { mkdir, mkdtemp, readFile, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, it, vi } from "vitest";
import { PAttachmentService } from "../../src/adapters/files/attachment-service.js";

afterEach(() => vi.unstubAllGlobals());
it("restricts uploads and downloads with a hash without overwriting", async () => {
  const dir = await mkdtemp(join(tmpdir(), "discord-mcp-"));
  const root = join(dir, "root");
  await mkdir(root);
  const path = join(root, "a.txt");
  await writeFile(path, "hello");
  const outside = join(dir, "outside");
  await writeFile(outside, "secret");
  await symlink(outside, join(root, "link"));
  const service = new PAttachmentService([root], dir);
  expect((await service.upload(path)).data.toString()).toBe("hello");
  await expect(service.upload(join(root, "link"))).rejects.toThrow();
  await expect(service.upload(`${root}/../outside`)).rejects.toThrow();
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response("hello")),
  );
  const result = await service.download("https://cdn.discordapp.com/a", "file.txt");
  expect(result.sha256).toBe("2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824");
  expect(await readFile(result.path, "utf8")).toBe("hello");
  await expect(service.download("https://cdn.discordapp.com/a", "file.txt")).rejects.toThrow();
  await expect(service.download("https://evil.example/a", "x")).rejects.toThrow();
});
