import { randomUUID } from "node:crypto";
import { ZodError } from "zod";
import { toToolError } from "../adapters/discord-rest/discord-rest.js";
import type { PPolicyEngine } from "./policy.js";
import { PToolError, redact } from "./tool-error.js";
import type { LogLevel, PToolRegistry, ToolContext } from "./tool-registry.js";

export interface ToolErrorResult {
  message: string;
  category: string;
  retryable: boolean;
  remediation: string;
  operation_id: string;
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
  progressToken?: string | number;
  notify?: (notification: { method: string; params: Record<string, unknown> }) => Promise<void>;
}
export class PToolPipeline {
  constructor(
    private readonly registry: PToolRegistry,
    private readonly policy: PPolicyEngine,
    private readonly services: Pick<ToolContext, "rest" | "files">,
    private readonly resolveGuild: (input: Record<string, unknown>) => Promise<string | undefined>,
  ) {}
  async call(name: string, input: unknown, session: CallSession = {}): Promise<ToolResult> {
    const correlation_id = randomUUID();
    const log = async (level: LogLevel, message: string) => {
      const data = redact(message);
      process.stderr.write(`[${level}] ${correlation_id} ${name}: ${data}\n`);
      await session.notify?.({
        method: "notifications/message",
        params: { level, logger: name, data },
      });
    };
    try {
      const tool = this.registry.get(name);
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
      this.policy.checkResource(
        tool,
        this.policy.allowedGuilds.length ? await this.resolveGuild(parsed.data) : undefined,
      );
      const { progressToken, notify } = session;
      const output = await tool.execute(parsed.data, {
        ...this.services,
        signal: session.signal ?? new AbortController().signal,
        progress: async (progress, total) => {
          if (progressToken !== undefined && notify)
            await notify({
              method: "notifications/progress",
              params: { progressToken, progress, ...(total === undefined ? {} : { total }) },
            });
        },
        log,
        correlation_id,
      });
      return { ok: true, data: tool.output.parse(output) };
    } catch (error) {
      const known = error instanceof PToolError ? error : toToolError(error, name);
      if (!known)
        await log("error", error instanceof Error ? (error.stack ?? error.message) : String(error));
      const mapped =
        known ??
        new PToolError(error instanceof ZodError ? "Invalid tool output" : "Operation failed", {
          category: "internal",
          retryable: false,
          remediation: `Check server logs for correlation ID ${correlation_id}`,
        });
      return {
        ok: false,
        error: {
          message: redact(mapped.message),
          category: mapped.category,
          retryable: mapped.retryable,
          remediation: mapped.remediation,
          operation_id: mapped.operationId ?? name,
          correlation_id,
          resource_ids: mapped.resourceIds,
          ...(mapped.status === undefined ? {} : { status: mapped.status }),
          ...(mapped.discordCode === undefined ? {} : { discord_code: mapped.discordCode }),
          ...(mapped.retryAfter === undefined ? {} : { retry_after: mapped.retryAfter }),
        },
      };
    }
  }
}
function describe(error: ZodError): string {
  return error.issues
    .map((issue) => `${issue.path.join(".") || "input"}: ${issue.message}`)
    .join("; ");
}
