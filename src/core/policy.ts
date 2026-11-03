import type { ResolvedScope } from "./ports.js";
import { PToolError } from "./tool-error.js";
import { DEFAULT_TOOLSETS, TOOLSETS, type ToolDescriptor, type Toolset } from "./tool-registry.js";

export type ApprovalMode = "elicitation" | "none";

// One startup line when server-side approval is off, so the operator makes an informed choice.
export function approvalNotice(approval: ApprovalMode): string | undefined {
  return approval === "none"
    ? "DISCORD_MCP_APPROVAL=none: server-side approval for destructive tools is disabled\n"
    : undefined;
}

export class PPolicyEngine {
  constructor(
    readonly allowedGuilds: string[],
    readonly toolsets: readonly Toolset[],
    readonly readOnly: boolean,
    readonly approval: ApprovalMode = "elicitation",
    readonly allowDms: boolean = false,
  ) {}
  static fromEnv(env: NodeJS.ProcessEnv): PPolicyEngine {
    const split = (s: string) =>
      s
        .split(",")
        .map((v) => v.trim())
        .filter(Boolean);
    const readOnly = env.DISCORD_MCP_READ_ONLY;
    if (readOnly !== undefined && readOnly !== "true" && readOnly !== "false")
      throw new Error("DISCORD_MCP_READ_ONLY must be true or false");
    const allowDms = env.DISCORD_MCP_ALLOW_DMS;
    if (allowDms !== undefined && allowDms !== "true" && allowDms !== "false")
      throw new Error("DISCORD_MCP_ALLOW_DMS must be true or false");
    const approval = env.DISCORD_MCP_APPROVAL ?? "elicitation";
    if (approval !== "elicitation" && approval !== "none")
      throw new Error("DISCORD_MCP_APPROVAL must be elicitation or none");
    const toolsets = split(env.DISCORD_MCP_TOOLSETS ?? DEFAULT_TOOLSETS.join(","));
    if (!toolsets.length || !toolsets.every(isToolset))
      throw new Error("Invalid DISCORD_MCP_TOOLSETS");
    return new PPolicyEngine(
      split(env.DISCORD_MCP_ALLOWED_GUILDS ?? ""),
      toolsets,
      readOnly === "true",
      approval,
      allowDms === "true",
    );
  }
  allows(tool: ToolDescriptor): boolean {
    return this.denial(tool) === undefined;
  }
  checkStatic(tool: ToolDescriptor): void {
    const denial = this.denial(tool);
    if (denial)
      throw new PToolError(denial[0], {
        category: "policy",
        retryable: false,
        remediation: denial[1],
      });
  }
  allowsGuild(id: string): boolean {
    return !this.allowedGuilds.length || this.allowedGuilds.includes(id);
  }
  checkResource(scope: ResolvedScope): void {
    if (!this.allowedGuilds.length) return;
    if (scope.noGuild) {
      throw new PToolError("Guild is not allowed", {
        category: "policy",
        retryable: false,
        remediation: "Choose an allowed guild",
      });
    }
    const hasGuild = scope.guildIds.length > 0;
    const allGuildsAllowed = hasGuild && scope.guildIds.every((id) => this.allowsGuild(id));
    if (scope.isDm) {
      if (!this.allowDms || (hasGuild && !allGuildsAllowed)) {
        throw new PToolError("Guild is not allowed", {
          category: "policy",
          retryable: false,
          remediation: "Choose an allowed guild",
        });
      }
      return;
    }
    if (!allGuildsAllowed) {
      throw new PToolError("Guild is not allowed", {
        category: "policy",
        retryable: false,
        remediation: "Choose an allowed guild",
      });
    }
  }
  private denial(tool: ToolDescriptor): [string, string] | undefined {
    if (!this.toolsets.includes(tool.toolset)) return ["Toolset disabled", "Enable the toolset"];
    if (this.readOnly && tool.effect !== "read")
      return ["Read-only mode", "Disable read-only mode"];
    return undefined;
  }
}
function isToolset(value: string): value is Toolset {
  return (TOOLSETS as readonly string[]).includes(value);
}
