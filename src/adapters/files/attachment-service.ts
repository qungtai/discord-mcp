import { createHash } from "node:crypto";
import { constants } from "node:fs";
import { open, realpath } from "node:fs/promises";
import { basename, isAbsolute, relative, resolve, sep } from "node:path";
import { PToolError } from "../../core/tool-error.js";

export class PAttachmentService {
  constructor(
    private readonly roots: string[],
    private readonly downloadDir: string,
  ) {}
  async upload(path: string, filename?: string): Promise<{ name: string; data: Buffer }> {
    if (!isAbsolute(path) || path.split(/[\\/]/).includes(".."))
      throw new PToolError("Invalid upload path", {
        category: "validation",
        retryable: false,
        remediation: "Use an absolute upload path",
      });
    const target = await realpath(path);
    if (this.roots.some((root) => !isAbsolute(root)))
      throw new PToolError("Upload roots must be absolute", {
        category: "validation",
        retryable: false,
        remediation: "Configure absolute upload roots",
      });
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
      throw new PToolError("Upload outside allowed roots", {
        category: "policy",
        retryable: false,
        remediation: "Choose a file inside an allowed root",
      });
    const handle = await open(target, constants.O_RDONLY | constants.O_NOFOLLOW);
    try {
      const info = await handle.stat();
      if (!info.isFile() || info.size > 25 * 1024 * 1024)
        throw new PToolError("Upload must be a regular file under 25 MiB", {
          category: "validation",
          retryable: false,
          remediation: "Choose a smaller regular file",
        });
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
      throw new PToolError("Invalid attachment URL", {
        category: "validation",
        retryable: false,
        remediation: "Use a Discord attachment URL",
      });
    if (
      !isAbsolute(this.downloadDir) ||
      basename(filename) !== filename ||
      filename === "." ||
      filename === ".."
    )
      throw new PToolError("Invalid download location", {
        category: "validation",
        retryable: false,
        remediation: "Configure an absolute download directory and valid filename",
      });
    const response = await fetch(parsed, { redirect: "error" });
    if (!response.ok)
      throw new PToolError("Download failed", {
        category: "discord",
        retryable: true,
        remediation: "Retry the download",
      });
    const data = Buffer.from(await response.arrayBuffer());
    const path = resolve(this.downloadDir, filename);
    let handle: Awaited<ReturnType<typeof open>>;
    try {
      handle = await open(path, "wx");
    } catch (error) {
      if (error instanceof Error && "code" in error && error.code === "EEXIST")
        throw new PToolError("Download already exists", {
          category: "conflict",
          retryable: false,
          remediation: "Choose a different filename",
          cause: error,
        });
      throw error;
    }
    try {
      await handle.writeFile(data);
    } finally {
      await handle.close();
    }
    return { path, size: data.length, sha256: createHash("sha256").update(data).digest("hex") };
  }
}
