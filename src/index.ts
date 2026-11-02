#!/usr/bin/env node
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { PDiscordRestAdapter } from "./adapters/discord-rest/discord-rest.js";
import { PAttachmentService } from "./adapters/files/attachment-service.js";
import { createServer } from "./adapters/mcp/server.js";
import { PToolPipeline } from "./core/pipeline.js";
import { PPolicyEngine } from "./core/policy.js";
import { PToolRegistry } from "./core/tool-registry.js";

const token = process.env.DISCORD_TOKEN;
if (!token) throw new Error("DISCORD_TOKEN is required");
const rest = new PDiscordRestAdapter(token);
const policy = PPolicyEngine.fromEnv(process.env);
const registry = await PToolRegistry.load();
const roots = (process.env.DISCORD_MCP_FILE_ROOTS ?? "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);
const files = new PAttachmentService(roots, process.env.DISCORD_MCP_DOWNLOAD_DIR ?? "");
const pipeline = new PToolPipeline(registry, policy, { rest, files }, async (input) => {
  if (typeof input.channel_id !== "string") return undefined;
  const channel = await rest.getChannel(input.channel_id);
  return "guild_id" in channel ? channel.guild_id : undefined;
});
await createServer(registry, pipeline).connect(new StdioServerTransport());
