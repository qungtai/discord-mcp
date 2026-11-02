import {
  DiscordAPIError,
  HTTPError,
  RateLimitError,
  REST,
  type RESTOptions,
  type RequestMethod,
} from "@discordjs/rest";
import type { DiscordRequestInit, DiscordTransport } from "../../core/ports.js";
import { type ErrorCategory, PToolError } from "../../core/tool-error.js";

// Slowest upload rate we wait for (about 0.5 Mbit/s), so a 25 MiB file gets several minutes.
const UPLOAD_BYTES_PER_MS = 64;
const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

export interface DiscordRestOptions {
  timeoutMs?: number;
  rateLimitWaitMs?: number;
  rest?: Partial<RESTOptions>;
}
export class PDiscordRestAdapter implements DiscordTransport {
  private readonly rest: REST;
  private readonly timeoutMs: number;
  constructor(token: string, options: DiscordRestOptions = {}) {
    this.timeoutMs = options.timeoutMs ?? 15_000;
    const rateLimitWaitMs = options.rateLimitWaitMs ?? 5_000;
    this.rest = new REST({
      version: "10",
      retries: 0,
      // The per-request signal enforces the real deadline; this is only an upper bound.
      timeout: Math.ceil(this.timeoutMs + MAX_UPLOAD_BYTES / UPLOAD_BYTES_PER_MS),
      rejectOnRateLimit: (data) => Math.max(data.retryAfter, data.timeToReset) > rateLimitWaitMs,
      ...options.rest,
    }).setToken(token);
  }
  async request<T>(request: DiscordRequestInit, signal: AbortSignal): Promise<T> {
    const bytes = request.files?.reduce((sum, file) => sum + file.data.length, 0) ?? 0;
    const deadline = AbortSignal.timeout(Math.ceil(this.timeoutMs + bytes / UPLOAD_BYTES_PER_MS));
    try {
      return (await this.rest.request({
        fullRoute: request.route,
        method: request.method as RequestMethod,
        query: request.query && toQuery(request.query),
        body: request.body,
        files: request.files,
        reason: request.reason,
        signal: AbortSignal.any([signal, deadline]),
      })) as T;
    } catch (error) {
      throw toToolError(error, signal.aborted);
    }
  }
}

const BY_STATUS: Record<number, [ErrorCategory, string]> = {
  400: ["validation", "Fix the request using Discord's error details"],
  401: ["permission", "Check DISCORD_TOKEN"],
  403: ["permission", "Check the bot permissions"],
  404: ["not_found", "Check the IDs in the request"],
  409: ["conflict", "Check the current state of the resource"],
  413: ["validation", "Send smaller files; Discord rejected the upload size"],
};
function toQuery(query: NonNullable<DiscordRequestInit["query"]>): URLSearchParams {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined) continue;
    for (const item of [value].flat()) params.append(key, String(item));
  }
  return params;
}
function toToolError(error: unknown, cancelled: boolean): PToolError {
  if (error instanceof RateLimitError)
    return new PToolError("Discord rate limit exceeded", {
      category: "rate_limited",
      retryable: true,
      remediation: "Retry after retry_after seconds",
      retryAfter: Math.ceil(Math.max(error.retryAfter, error.timeToReset) / 1000),
    });
  if (error instanceof DiscordAPIError || error instanceof HTTPError) {
    const { status } = error;
    const [category, remediation] = BY_STATUS[status] ?? [
      "discord",
      status >= 500 ? "Retry later" : "Check the request",
    ];
    return new PToolError(
      error instanceof DiscordAPIError
        ? `Discord rejected the request (HTTP ${status}): ${error.message}`
        : `Discord request failed (HTTP ${status})`,
      {
        category,
        retryable: status >= 500,
        remediation,
        status,
        discordCode: error instanceof DiscordAPIError ? error.code : undefined,
        cause: error,
      },
    );
  }
  if (cancelled)
    return new PToolError("Request cancelled", {
      category: "cancelled",
      retryable: false,
      remediation: "Send the request again if it is still needed",
      cause: error,
    });
  return new PToolError("Discord request failed before a response", {
    category: "discord",
    retryable: true,
    remediation: "Retry later",
    cause: error,
  });
}
