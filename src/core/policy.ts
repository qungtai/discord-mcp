import type { ResolvedScope } from "./ports.js";
import { PToolError } from "./tool-error.js";
import { DEFAULT_TOOLSETS, TOOLSETS, type ToolDescriptor, type Toolset } from "./tool-registry.js";

export type ApprovalMode = "elicitation" | "none";

export class PPolicyEngine {
  constructor(
    readonly allowedGuilds: string[],
    readonly toolsets: readonly Toolset[],
    readonly readOnly: boolean,
    readonly approval: ApprovalMode = "elicitation",
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
    if (
      this.allowedGuilds.length &&
      (!scope.guildIds.length || scope.isDm || !scope.guildIds.every((id) => this.allowsGuild(id)))
    )
      throw new PToolError("Guild is not allowed", {
        category: "policy",
        retryable: false,
        remediation: "Choose an allowed guild",
      });
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
