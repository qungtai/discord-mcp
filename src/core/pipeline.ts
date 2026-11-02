import { randomUUID } from "node:crypto";
import type { z } from "zod/v4";
import type { PPolicyEngine } from "./policy.js";
import type {
  AttachmentPort,
  DiscordRequest,
  DiscordRequestInit,
  DiscordTransport,
  ScopeResolver,
} from "./ports.js";
import { type ErrorCategory, PToolError, redact } from "./tool-error.js";
import {
  type CredentialProfile,
  type LogLevel,
  type PToolRegistry,
  scopeIds,
  type ToolDescriptor,
} from "./tool-registry.js";

export interface ToolErrorResult {
  message: string;
  category: ErrorCategory;
  retryable: boolean;
  remediation: string;
  tool: string;
  correlation_id: string;
  resource_ids: Record<string, string>;
  status?: number;
  discord_code?: number | string;
  retry_after?: number;
}
export type ToolResult =
  | { ok: true; data: Record<string, unknown> }
  | { ok: false; error: ToolErrorResult };
export interface CallSession {
  signal?: AbortSignal;
  progress?: (progress: number, total?: number) => Promise<void>;
  log?: (level: LogLevel, data: string) => Promise<void>;
}
export interface PipelineServices {
  credentials: Partial<Record<CredentialProfile, DiscordTransport>>;
  files: AttachmentPort;
  resolveScope: ScopeResolver;
}
const LOGGED_CATEGORIES = new Set(["discord", "uncertain", "internal"]);

export class PToolPipeline {
  constructor(
    private readonly registry: PToolRegistry,
    private readonly policy: PPolicyEngine,
    private readonly services: PipelineServices,
  ) {}
  tools(): ToolDescriptor[] {
    return this.registry.list().filter((tool) => this.policy.allows(tool));
  }
  async call(name: string, input: unknown, session: CallSession = {}): Promise<ToolResult> {
    const correlationId = randomUUID();
    const log = async (level: LogLevel, message: string) => {
      const data = redact(message);
      process.stderr.write(`[${level}] ${correlationId} ${name}: ${data}\n`);
      await session.log?.(level, data);
    };
    const tool = this.registry.get(name);
    let resources: Record<string, string> = {};
    let committed = false;
    let committedId: string | undefined;
    const audit = (outcome: string) => {
      if (!tool || tool.effect === "read") return;
      const record = {
        correlation_id: correlationId,
        tool: name,
        credential: tool.credential,
        resource_ids: { ...resources, ...(committedId ? { id: committedId } : {}) },
        outcome,
      };
      process.stderr.write(`[audit] ${JSON.stringify(record)}\n`);
    };
    try {
      if (!tool)
        throw new PToolError(`Unknown tool: ${name}`, {
          category: "not_found",
          retryable: false,
          remediation: "Choose a listed tool",
        });
      const parsed = tool.input.safeParse(input ?? {});
      if (!parsed.success)
        throw new PToolError(`Invalid input: ${describe(parsed.error)}`, {
          category: "validation",
          retryable: false,
          remediation: "Fix the arguments to match the tool input schema",
        });
      this.policy.checkStatic(tool);
      const ids = scopeIds(tool, parsed.data);
      resources = ids.resources;
      const transport = this.services.credentials[tool.credential];
      if (!transport)
        throw new PToolError(`Credential profile ${tool.credential} is not configured`, {
          category: "policy",
          retryable: false,
          remediation: `Configure the ${tool.credential} credential`,
        });
      const signal = session.signal ?? new AbortController().signal;
      const progress = async (value: number, total?: number) => session.progress?.(value, total);
      let nonce: string | undefined;
      const discord: DiscordRequest = async <T>(request: DiscordRequestInit) => {
        if (request.method === "GET") return transport.request<T>(request, signal);
        nonce = nonceOf(request.body) ?? nonce;
        if (request.files?.length) await progress(0, 1);
        try {
          const response = await transport.request<T>(request, signal);
          committed = true;
          committedId = responseId(response).id ?? committedId;
          if (request.files?.length) await progress(1, 1);
          return response;
        } catch (error) {
          if (tool.idempotent || !mayHaveCommitted(error)) throw error;
          throw uncertain(error);
        }
      };
      const uncertain = (cause: unknown) =>
        new PToolError("The write may have been applied", {
          category: "uncertain",
          retryable: false,
          remediation: nonce
            ? "Check the result before retrying, or retry with the same nonce"
            : "Check the resource before retrying",
          resourceIds: {
            ...resources,
            ...(committedId ? { id: committedId } : {}),
            ...(nonce ? { nonce } : {}),
          },
          cause,
        });
      if (this.policy.allowedGuilds.length)
        this.policy.checkResource(await this.services.resolveScope(ids.byKind, discord));
      const { files } = this.services;
      const output = await tool
        .execute(parsed.data, {
          discord,
          files: {
            prepare: (uploads) => files.prepare(uploads),
            merge: (existing, change) => files.merge(existing, change),
            download: (url, filename) => files.download(url, filename, signal),
          },
          signal,
          progress,
          log,
          correlationId,
        })
        .catch((error: unknown) => {
          // A failure after an earlier write committed leaves a partial change behind.
          if (!committed || tool.idempotent) throw error;
          if (error instanceof PToolError && error.category === "uncertain") throw error;
          throw uncertain(error);
        });
      const result = tool.output.safeParse(output);
      if (result.success) {
        audit("ok");
        return { ok: true, data: result.data };
      }
      throw new PToolError(
        committed
          ? "Discord accepted the request but the response did not match the output schema"
          : "Invalid tool output",
        {
          category: "internal",
          retryable: false,
          remediation: committed
            ? "Do not repeat the request; read the resource back to verify it"
            : `Check server logs for correlation ID ${correlationId}`,
          resourceIds: { ...resources, ...responseId(output) },
          cause: new Error(describe(result.error)),
        },
      );
    } catch (error) {
      const known = error instanceof PToolError ? error : undefined;
      if (!known)
        await log("error", error instanceof Error ? (error.stack ?? error.message) : String(error));
      else if (known.cause !== undefined || LOGGED_CATEGORIES.has(known.category))
        await log("warning", `${known.category}: ${known.message}${causeText(known.cause)}`);
      const mapped =
        known ??
        new PToolError("Operation failed", {
          category: "internal",
          retryable: false,
          remediation: `Check server logs for correlation ID ${correlationId}`,
        });
      audit(mapped.category);
      const permissions = mapped.status === 403 ? tool?.permissions : undefined;
      return {
        ok: false,
        error: {
          message: redact(mapped.message),
          category: mapped.category,
          retryable: mapped.retryable,
          remediation: permissions?.length
            ? `${mapped.remediation}; this tool needs ${permissions.join(", ")}`
            : mapped.remediation,
          tool: name,
          correlation_id: correlationId,
          resource_ids: { ...resources, ...mapped.resourceIds },
          ...(mapped.status === undefined ? {} : { status: mapped.status }),
          ...(mapped.discordCode === undefined ? {} : { discord_code: mapped.discordCode }),
          ...(mapped.retryAfter === undefined ? {} : { retry_after: mapped.retryAfter }),
        },
      };
    }
  }
}
// Server errors, timeouts, network failures and cancellation can all follow a committed write.
function mayHaveCommitted(error: unknown): boolean {
  if (!(error instanceof PToolError)) return true;
  if (error.category === "cancelled") return true;
  return error.category === "discord" && (error.status === undefined || error.status >= 500);
}
function nonceOf(body: unknown): string | undefined {
  return typeof body === "object" &&
    body !== null &&
    "nonce" in body &&
    typeof body.nonce === "string"
    ? body.nonce
    : undefined;
}
function responseId(output: unknown): Record<string, string> {
  if (typeof output !== "object" || output === null) return {};
  for (const value of [output, ...Object.values(output)])
    if (
      typeof value === "object" &&
      value !== null &&
      "id" in value &&
      typeof value.id === "string"
    )
      return { id: value.id };
  return {};
}
function causeText(cause: unknown): string {
  const chain: string[] = [];
  for (
    let c = cause;
    c !== undefined && chain.length < 5;
    c = c instanceof Error ? c.cause : undefined
  )
    chain.push(c instanceof Error ? `${c.name}: ${c.message}` : String(c));
  return chain.length ? ` (cause: ${chain.join(" <- ")})` : "";
}
function describe(error: z.ZodError): string {
  return error.issues
    .map((issue) => `${issue.path.join(".") || "input"}: ${issue.message}`)
    .join("; ");
}
