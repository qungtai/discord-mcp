export type ErrorCategory =
  | "validation"
  | "policy"
  | "not_found"
  | "permission"
  | "conflict"
  | "rate_limited"
  | "discord"
  | "uncertain"
  | "internal";
export interface ToolErrorOptions {
  category: ErrorCategory;
  retryable: boolean;
  remediation: string;
  operationId?: string;
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
  readonly operationId?: string;
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
    this.operationId = options.operationId;
    this.resourceIds = options.resourceIds ?? {};
    this.status = options.status;
    this.discordCode = options.discordCode;
    this.retryAfter = options.retryAfter;
  }
}
