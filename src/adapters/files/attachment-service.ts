import { createHash } from "node:crypto";
import { constants } from "node:fs";
import { mkdir, open, realpath, unlink } from "node:fs/promises";
import { homedir } from "node:os";
import { basename, isAbsolute, join, relative, resolve, sep } from "node:path";
import type {
  AttachmentPort,
  AttachmentUpdate,
  DownloadResult,
  FileUpload,
  Multipart,
  RawFile,
} from "../../core/ports.js";
import { PToolError } from "../../core/tool-error.js";

function hasHiddenComponent(path: string): boolean {
  return path.split(/[\\/]/).some((part) => part.startsWith("."));
}

export class PAttachmentService implements AttachmentPort {
  static fromEnv(env: NodeJS.ProcessEnv = process.env): PAttachmentService {
    const roots = (env.DISCORD_MCP_FILE_ROOTS ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const downloadDir = env.DISCORD_MCP_DOWNLOAD_DIR || join(homedir(), "Downloads", "discord-mcp");
    const rawMax = env.DISCORD_MCP_MAX_UPLOAD_BYTES;
    let maxUploadBytes: number | undefined;
    if (rawMax !== undefined) {
      const parsed = Number(rawMax);
      if (!Number.isInteger(parsed) || parsed <= 0)
        throw new Error("DISCORD_MCP_MAX_UPLOAD_BYTES must be a positive integer");
      maxUploadBytes = parsed;
    }
    return new PAttachmentService(roots, downloadDir, maxUploadBytes);
  }

  constructor(
    private readonly roots: string[],
    private readonly downloadDir: string = join(homedir(), "Downloads", "discord-mcp"),
    private readonly maxUploadBytes = 20 * 1024 * 1024,
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
    existing: readonly { id: string; description?: string | null; flags?: number }[],
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
            // Flag 8 is IS_SPOILER; resend it so a kept attachment never loses its spoiler.
            is_spoiler: update?.is_spoiler ?? ((a.flags ?? 0) & 8 ? true : undefined),
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
    if (this.roots.length === 0) {
      if (hasHiddenComponent(path))
        throw new PToolError("Hidden files and folders are not uploaded by default", {
          category: "policy",
          retryable: false,
          remediation: "Set DISCORD_MCP_FILE_ROOTS to a folder that contains the file to allow it",
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
      if (hasHiddenComponent(target))
        throw new PToolError("Hidden files and folders are not uploaded by default", {
          category: "policy",
          retryable: false,
          remediation: "Set DISCORD_MCP_FILE_ROOTS to a folder that contains the file to allow it",
        });
      const handle = await open(target, constants.O_RDONLY | constants.O_NOFOLLOW);
      try {
        const info = await handle.stat();
        if (!info.isFile() || info.size > this.maxUploadBytes)
          throw new PToolError(
            `Upload must be a regular file of at most ${this.maxUploadBytes} bytes`,
            {
              category: "validation",
              retryable: false,
              remediation: "Choose a smaller regular file",
            },
          );
        return { name: filename ?? basename(target), data: await handle.readFile() };
      } finally {
        await handle.close();
      }
    }
    if (this.roots.some((root) => !isAbsolute(root)))
      throw new PToolError("Upload roots must be absolute", {
        category: "validation",
        retryable: false,
        remediation: "Configure absolute upload roots",
      });
    const outside = new PToolError("Upload outside allowed roots", {
      category: "policy",
      retryable: false,
      remediation: "Choose a file inside an allowed root",
    });
    // A missing root holds no files, so it is skipped instead of failing uploads under other roots.
    const realRoots = (
      await Promise.all(
        this.roots.map((root) =>
          realpath(root).catch((error: unknown) => {
            if (code(error) === "ENOENT") return undefined;
            throw error;
          }),
        ),
      )
    ).filter((root) => root !== undefined);
    // Lexical check first, so paths outside the roots never reveal whether they exist.
    if (!within([...this.roots, ...realRoots], path)) throw outside;
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
    if (!within(realRoots, target)) throw outside;
    const handle = await open(target, constants.O_RDONLY | constants.O_NOFOLLOW);
    try {
      const info = await handle.stat();
      if (!info.isFile() || info.size > this.maxUploadBytes)
        throw new PToolError(
          `Upload must be a regular file of at most ${this.maxUploadBytes} bytes`,
          {
            category: "validation",
            retryable: false,
            remediation: "Choose a smaller regular file",
          },
        );
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
    await mkdir(this.downloadDir, { recursive: true });
    const handle = await open(path, "wx").catch((error: unknown) => {
      if (code(error) === "EEXIST")
        throw new PToolError("Download already exists", {
          category: "conflict",
          retryable: false,
          remediation: "Remove or move the existing file first",
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
function within(roots: readonly string[], target: string): boolean {
  return roots.some((root) => {
    const rel = relative(root, target);
    return rel === "" || (rel !== ".." && !rel.startsWith(`..${sep}`) && !isAbsolute(rel));
  });
}
function code(error: unknown): unknown {
  return error instanceof Error && "code" in error ? error.code : undefined;
}
