import { createHash } from "node:crypto";
import { constants } from "node:fs";
import { open, realpath, unlink } from "node:fs/promises";
import { basename, isAbsolute, relative, resolve, sep } from "node:path";
import type {
  AttachmentPort,
  AttachmentUpdate,
  DownloadResult,
  FileUpload,
  Multipart,
  RawFile,
} from "../../core/ports.js";
import { PToolError } from "../../core/tool-error.js";

export class PAttachmentService implements AttachmentPort {
  constructor(
    private readonly roots: string[],
    private readonly downloadDir: string,
  ) {}
  async prepare(uploads: readonly FileUpload[]): Promise<Multipart> {
    const files = await Promise.all(
      uploads.map(async (f) => ({
        ...(await this.upload(f.path, f.filename)),
        contentType: f.content_type,
      })),
    );
    return {
      files,
      attachments: files.map((file, i) => ({
        id: String(i),
        filename: file.name,
        description: uploads[i]?.description,
        title: uploads[i]?.title,
        is_spoiler: uploads[i]?.is_spoiler,
      })),
    };
  }
  // Keeps every existing attachment, applies metadata updates and appends new uploads.
  async merge(
    existing: readonly { id: string; description?: string | null }[],
    change: { add?: readonly FileUpload[]; update?: readonly AttachmentUpdate[] },
  ): Promise<Multipart> {
    for (const { id } of change.update ?? [])
      if (!existing.some((a) => a.id === id))
        throw new PToolError("Unknown attachment", {
          category: "not_found",
          retryable: false,
          remediation: "Choose an existing attachment",
          resourceIds: { attachment_id: id },
        });
    const added = await this.prepare(change.add ?? []);
    return {
      files: added.files,
      attachments: [
        ...existing.map((a) => {
          const update = change.update?.find((u) => u.id === a.id);
          return {
            id: a.id,
            description: update?.description ?? a.description ?? undefined,
            is_spoiler: update?.is_spoiler,
          };
        }),
        ...added.attachments,
      ],
    };
  }
  async upload(path: string, filename?: string): Promise<RawFile> {
    if (!isAbsolute(path) || path.split(/[\\/]/).includes(".."))
      throw new PToolError("Invalid upload path", {
        category: "validation",
        retryable: false,
        remediation: "Use an absolute upload path",
      });
    const target = await realpath(path).catch((error: unknown) => {
      throw code(error) === "ENOENT"
        ? new PToolError("Upload file not found", {
            category: "not_found",
            retryable: false,
            remediation: "Check the upload path",
            cause: error,
          })
        : error;
    });
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
  async download(url: string, filename: string, signal?: AbortSignal): Promise<DownloadResult> {
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
    const path = resolve(this.downloadDir, filename);
    const handle = await open(path, "wx").catch((error: unknown) => {
      if (code(error) === "EEXIST")
        throw new PToolError("Download already exists", {
          category: "conflict",
          retryable: false,
          remediation: "Remove or move the existing file first",
          cause: error,
        });
      if (code(error) === "ENOENT")
        throw new PToolError("Download directory does not exist", {
          category: "validation",
          retryable: false,
          remediation: "Create DISCORD_MCP_DOWNLOAD_DIR or point it at an existing directory",
          cause: error,
        });
      throw error;
    });
    let data: Buffer;
    try {
      data = await fetchAttachment(parsed, signal);
      await handle.writeFile(data);
    } catch (error) {
      await handle.close();
      await unlink(path);
      throw error;
    }
    await handle.close();
    return { path, size: data.length, sha256: createHash("sha256").update(data).digest("hex") };
  }
}
async function fetchAttachment(url: URL, signal?: AbortSignal): Promise<Buffer> {
  try {
    const response = await fetch(url, { redirect: "error", signal });
    if (!response.ok)
      throw new PToolError("Download failed", {
        category: "discord",
        retryable: true,
        remediation: "Retry the download",
        status: response.status,
      });
    return Buffer.from(await response.arrayBuffer());
  } catch (error) {
    if (error instanceof PToolError) throw error;
    throw signal?.aborted
      ? new PToolError("Download cancelled", {
          category: "cancelled",
          retryable: false,
          remediation: "Download again if it is still needed",
          cause: error,
        })
      : new PToolError("Download failed before a response", {
          category: "discord",
          retryable: true,
          remediation: "Retry the download",
          cause: error,
        });
  }
}
function code(error: unknown): unknown {
  return error instanceof Error && "code" in error ? error.code : undefined;
}
