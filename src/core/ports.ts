export interface RawFile {
  name: string;
  data: Buffer;
  contentType?: string;
  key?: string;
}
export interface DiscordRequestInit {
  method: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  route: `/${string}`;
  // Undefined values are dropped, so a tool can pass its parsed input directly. String arrays repeat the key.
  query?: Record<string, string | number | boolean | string[] | undefined>;
  body?: unknown;
  files?: RawFile[];
  reason?: string;
  auth?: false;
}
export type DiscordRequest = <T = unknown>(request: DiscordRequestInit) => Promise<T>;
// Implemented by transport adapters; failures are thrown as PToolError.
export interface DiscordTransport {
  request<T>(request: DiscordRequestInit, signal: AbortSignal): Promise<T>;
}

export interface FileUpload {
  path: string;
  filename?: string;
  description?: string;
  is_spoiler?: boolean;
  title?: string;
  content_type?: string;
}
export interface AttachmentUpdate {
  id: string;
  description?: string;
  is_spoiler?: boolean;
}
export interface AttachmentPayload {
  id: string;
  filename?: string;
  description?: string;
  title?: string;
  is_spoiler?: boolean;
}
export interface Multipart {
  files: RawFile[];
  attachments: AttachmentPayload[];
}
export interface DownloadResult {
  path: string;
  size: number;
  sha256: string;
}
export interface AttachmentPort {
  prepare(uploads: readonly FileUpload[]): Promise<Multipart>;
  merge(
    existing: readonly { id: string; description?: string | null; flags?: number }[],
    change: { add?: readonly FileUpload[]; update?: readonly AttachmentUpdate[] },
  ): Promise<Multipart>;
  download(url: string, filename: string, signal?: AbortSignal): Promise<DownloadResult>;
}
// The per-call file port handed to tools; the pipeline binds the call signal.
export interface ToolFiles extends Omit<AttachmentPort, "download"> {
  download(url: string, filename: string): Promise<DownloadResult>;
}

export type ScopeKind = "guild" | "channel" | "message" | "webhook" | "user" | "invite";
export type ScopeIds = Partial<Record<ScopeKind, string[]>>;
export interface ResolvedScope {
  guildIds: string[];
  channelIds: string[];
  isDm: boolean;
  noGuild: boolean;
}
export type ScopeResolver = (ids: ScopeIds, discord: DiscordRequest) => Promise<ResolvedScope>;
