import { createHash } from "node:crypto";
import { constants } from "node:fs";
import { open, realpath } from "node:fs/promises";
import { basename, isAbsolute, relative, resolve, sep } from "node:path";

export class PAttachmentService {
  constructor(
    private readonly roots: string[],
    private readonly downloadDir: string,
  ) {}
  async upload(path: string, filename?: string): Promise<{ name: string; data: Buffer }> {
    if (!isAbsolute(path) || path.split(/[\\/]/).includes(".."))
      throw new Error("Invalid upload path");
    const target = await realpath(path);
    if (this.roots.some((root) => !isAbsolute(root)))
      throw new Error("Upload roots must be absolute");
    const roots = await Promise.all(this.roots.map((root) => realpath(root)));
    if (
      !roots.some(
        (root) =>
          target === root ||
          (!relative(root, target).startsWith(`..${sep}`) &&
            relative(root, target) !== ".." &&
            !isAbsolute(relative(root, target))),
      )
    )
      throw new Error("Upload outside allowed roots");
    const handle = await open(target, constants.O_RDONLY | constants.O_NOFOLLOW);
    try {
      const info = await handle.stat();
      if (!info.isFile() || info.size > 25 * 1024 * 1024)
        throw new Error("Upload must be a regular file under 25 MiB");
      return { name: filename ?? basename(target), data: await handle.readFile() };
    } finally {
      await handle.close();
    }
  }
  async download(
    url: string,
    filename: string,
  ): Promise<{ path: string; size: number; sha256: string }> {
    const parsed = new URL(url);
    if (
      parsed.protocol !== "https:" ||
      !["cdn.discordapp.com", "media.discordapp.net"].includes(parsed.hostname)
    )
      throw new Error("Invalid attachment URL");
    if (
      !isAbsolute(this.downloadDir) ||
      basename(filename) !== filename ||
      filename === "." ||
      filename === ".."
    )
      throw new Error("Invalid download location");
    const response = await fetch(parsed, { redirect: "error" });
    if (!response.ok) throw new Error("Download failed");
    const data = Buffer.from(await response.arrayBuffer());
    const path = resolve(this.downloadDir, filename);
    const handle = await open(path, "wx");
    try {
      await handle.writeFile(data);
    } finally {
      await handle.close();
    }
    return { path, size: data.length, sha256: createHash("sha256").update(data).digest("hex") };
  }
}
