export type ErrorCategory =
  | "validation"
  | "policy"
  | "not_found"
  | "permission"
  | "conflict"
  | "rate_limited"
  | "discord"
  | "uncertain"
  | "cancelled"
  | "internal";
export interface ToolErrorOptions {
  category: ErrorCategory;
  retryable: boolean;
  remediation: string;
  resourceIds?: Record<string, string>;
  status?: number;
  discordCode?: number | string;
  retryAfter?: number;
  cause?: unknown;
}
export class PToolError extends Error {
  readonly category: ErrorCategory;
  readonly retryable: boolean;
  readonly remediation: string;
  readonly resourceIds: Record<string, string>;
  readonly status?: number;
  readonly discordCode?: number | string;
  readonly retryAfter?: number;
  constructor(message: string, options: ToolErrorOptions) {
    super(message, { cause: options.cause });
    this.name = "PToolError";
    this.category = options.category;
    this.retryable = options.retryable;
    this.remediation = options.remediation;
    this.resourceIds = options.resourceIds ?? {};
    this.status = options.status;
    this.discordCode = options.discordCode;
    this.retryAfter = options.retryAfter;
  }
}
// A bot or bearer credential is at least 20 characters of [\w.-]; shorter words stay readable.
const TOKEN = /(Bot|Bearer) [\w.-]{20,}/g;
export function redact(text: string, secrets = [process.env.DISCORD_TOKEN]): string {
  let out = text
    .replace(TOKEN, "$1 [redacted]")
    .replace(/(webhooks\/\d+\/)[\w-]+/g, "$1[redacted]");
  for (const secret of secrets) if (secret) out = out.split(secret).join("[redacted]");
  return out;
}
