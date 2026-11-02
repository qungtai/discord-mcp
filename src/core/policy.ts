import { PToolError } from "./tool-error.js";
import type { ToolDescriptor } from "./tool-registry.js";

export class PPolicyEngine {
  constructor(
    readonly allowedGuilds: string[],
    readonly toolsets: string[],
    readonly readOnly: boolean,
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
    const toolsets = split(env.DISCORD_MCP_TOOLSETS ?? "core,messages");
    if (!toolsets.length || toolsets.some((toolset) => !["core", "messages"].includes(toolset)))
      throw new Error("Invalid DISCORD_MCP_TOOLSETS");
    return new PPolicyEngine(
      split(env.DISCORD_MCP_ALLOWED_GUILDS ?? ""),
      toolsets,
      env.DISCORD_MCP_READ_ONLY === "true",
    );
  }
  checkStatic(tool: ToolDescriptor): void {
    if (!this.toolsets.includes(tool.toolset))
      throw new PToolError("Toolset disabled", {
        category: "policy",
        retryable: false,
        remediation: "Enable the toolset",
        operationId: tool.name,
      });
    if (this.readOnly && tool.effect !== "read")
      throw new PToolError("Read-only mode", {
        category: "policy",
        retryable: false,
        remediation: "Disable read-only mode",
        operationId: tool.name,
      });
  }
  checkResource(tool: ToolDescriptor, guildId?: string): void {
    if (this.allowedGuilds.length && (!guildId || !this.allowedGuilds.includes(guildId)))
      throw new PToolError("Guild is not allowed", {
        category: "policy",
        retryable: false,
        remediation: "Choose an allowed guild",
        operationId: tool.name,
      });
  }
  check(tool: ToolDescriptor, guildId?: string): void {
    this.checkStatic(tool);
    this.checkResource(tool, guildId);
  }
}
