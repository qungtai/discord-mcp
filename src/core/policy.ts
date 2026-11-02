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
    return new PPolicyEngine(
      split(env.DISCORD_MCP_ALLOWED_GUILDS ?? ""),
      split(env.DISCORD_MCP_TOOLSETS ?? "core,messages"),
      env.DISCORD_MCP_READ_ONLY === "true",
    );
  }
  check(tool: ToolDescriptor, guildId?: string): void {
    if (!this.toolsets.includes(tool.toolset))
      throw new PToolError("Toolset disabled", "policy", false, "Enable the toolset", tool.name);
    if (this.readOnly && tool.mutating)
      throw new PToolError("Read-only mode", "policy", false, "Disable read-only mode", tool.name);
    if (this.allowedGuilds.length && (!guildId || !this.allowedGuilds.includes(guildId)))
      throw new PToolError(
        "Guild is not allowed",
        "policy",
        false,
        "Choose an allowed guild",
        tool.name,
      );
  }
}
