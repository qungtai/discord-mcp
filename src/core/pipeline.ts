import { randomUUID } from "node:crypto";
import { ZodError } from "zod";
import { toToolError } from "../adapters/discord-rest/discord-rest.js";
import type { PPolicyEngine } from "./policy.js";
import { PToolError } from "./tool-error.js";
import type { PToolRegistry, ToolContext } from "./tool-registry.js";

export type ToolResult =
  | { ok: true; data: Record<string, unknown> }
  | {
      ok: false;
      error: {
        message: string;
        category: string;
        retryable: boolean;
        remediation: string;
        operation_id: string;
        resource_ids: Record<string, string>;
      };
    };
export class PToolPipeline {
  constructor(
    private readonly registry: PToolRegistry,
    private readonly policy: PPolicyEngine,
    private readonly context: Pick<ToolContext, "rest" | "files">,
    private readonly resolveGuild: (input: Record<string, unknown>) => Promise<string | undefined>,
  ) {}
  async call(name: string, input: unknown): Promise<ToolResult> {
    try {
      const tool = this.registry.get(name);
      if (!tool)
        throw new PToolError("Unknown tool", {
          category: "not_found",
          retryable: false,
          remediation: "Choose a listed tool",
          operationId: name,
        });
      const parsed: Record<string, unknown> = tool.input.parse(input);
      this.policy.checkStatic(tool);
      this.policy.checkResource(
        tool,
        this.policy.allowedGuilds.length ? await this.resolveGuild(parsed) : undefined,
      );
      const data: Record<string, unknown> = tool.output.parse(
        await tool.handler(parsed, {
          ...this.context,
          signal: new AbortController().signal,
          progress: () => {},
          log: () => {},
          correlationId: randomUUID(),
        }),
      );
      return { ok: true, data };
    } catch (error) {
      const safe =
        error instanceof PToolError
          ? error
          : error instanceof ZodError
            ? new PToolError("Invalid input or output", {
                category: "validation",
                retryable: false,
                remediation: "Check the tool schema",
                operationId: name,
              })
            : toToolError(error, name);
      if (!safe) process.stderr.write("Unknown tool error: [redacted]\n");
      const mapped =
        safe ??
        new PToolError("Operation failed", {
          category: "internal",
          retryable: false,
          remediation: "Check server logs",
          operationId: name,
        });
      return {
        ok: false,
        error: {
          message: mapped.message,
          category: mapped.category,
          retryable: mapped.retryable,
          remediation: mapped.remediation,
          operation_id: mapped.operationId ?? name,
          resource_ids: mapped.resourceIds,
          ...(mapped.status === undefined ? {} : { status: mapped.status }),
          ...(mapped.discordCode === undefined ? {} : { discord_code: mapped.discordCode }),
          ...(mapped.retryAfter === undefined ? {} : { retry_after: mapped.retryAfter }),
        },
      };
    }
  }
}
