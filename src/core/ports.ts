export interface RawFile {
  name: string;
  data: Buffer;
  contentType?: string;
}
export interface DiscordRequestInit {
  method: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  route: `/${string}`;
  query?: URLSearchParams;
  body?: unknown;
  files?: RawFile[];
  reason?: string;
  // Webhook and interaction token routes authenticate through the route itself.
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
    existing: readonly { id: string; description?: string | null }[],
    change: { add?: readonly FileUpload[]; update?: readonly AttachmentUpdate[] },
  ): Promise<Multipart>;
  download(url: string, filename: string, signal?: AbortSignal): Promise<DownloadResult>;
}

export type ScopeKind = "guild" | "channel" | "message" | "webhook" | "user" | "invite";
export type ScopeIds = Partial<Record<ScopeKind, string[]>>;
export interface ResolvedScope {
  guildIds: string[];
  channelIds: string[];
  isDm: boolean;
}
export type ScopeResolver = (ids: ScopeIds, discord: DiscordRequest) => Promise<ResolvedScope>;
