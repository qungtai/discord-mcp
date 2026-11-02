import { ZodError } from "zod";
import type { PPolicyEngine } from "./policy.js";
import { PToolError } from "./tool-error.js";
import type { PToolRegistry } from "./tool-registry.js";

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
    private readonly resolveGuild: (input: Record<string, unknown>) => Promise<string | undefined>,
  ) {}
  async call(name: string, input: unknown): Promise<ToolResult> {
    try {
      const tool = this.registry.get(name);
      if (!tool)
        throw new PToolError("Unknown tool", "not_found", false, "Choose a listed tool", name);
      const parsed: Record<string, unknown> = tool.input.parse(input);
      this.policy.check(
        tool,
        this.policy.allowedGuilds.length ? await this.resolveGuild(parsed) : undefined,
      );
      const data: Record<string, unknown> = tool.output.parse(await tool.handler(parsed));
      return { ok: true, data };
    } catch (error) {
      const safe =
        error instanceof PToolError
          ? error
          : error instanceof ZodError
            ? new PToolError(
                "Invalid input or output",
                "validation",
                false,
                "Check the tool schema",
                name,
              )
            : new PToolError(
                "Operation failed",
                "internal",
                false,
                "Check server configuration and permissions",
                name,
              );
      return {
        ok: false,
        error: {
          message: safe.message,
          category: safe.category,
          retryable: safe.retryable,
          remediation: safe.remediation,
          operation_id: safe.operationId ?? name,
          resource_ids: safe.resourceIds,
        },
      };
    }
  }
}
