#!/usr/bin/env node
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { PDiscordRestAdapter } from "./adapters/discord-rest/discord-rest.js";
import { PAttachmentService } from "./adapters/files/attachment-service.js";
import { createServer } from "./adapters/mcp/server.js";
import { PToolPipeline } from "./core/pipeline.js";
import { approvalNotice, PPolicyEngine } from "./core/policy.js";
import { createScopeResolver } from "./core/scope.js";
import { PToolRegistry } from "./core/tool-registry.js";

const token = process.env.DISCORD_TOKEN;
if (!token) throw new Error("DISCORD_TOKEN is required");
const positiveInt = (name: string) => {
  const value = process.env[name];
  if (value === undefined) return undefined;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0)
    throw new Error(`${name} must be a positive integer`);
  return parsed;
};
const bot = new PDiscordRestAdapter(token, {
  timeoutMs: positiveInt("DISCORD_MCP_REQUEST_TIMEOUT_MS"),
  rateLimitWaitMs: positiveInt("DISCORD_MCP_RATE_LIMIT_WAIT_MS"),
});
const policy = PPolicyEngine.fromEnv(process.env);
const notice = approvalNotice(policy.approval);
if (notice) process.stderr.write(notice);
const registry = await PToolRegistry.load();
const roots = (process.env.DISCORD_MCP_FILE_ROOTS ?? "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);
const files = new PAttachmentService(
  roots,
  process.env.DISCORD_MCP_DOWNLOAD_DIR ?? "",
  positiveInt("DISCORD_MCP_MAX_UPLOAD_BYTES"),
);
const pipeline = new PToolPipeline(registry, policy, {
  credentials: { bot },
  files,
  resolveScope: createScopeResolver(),
});
await createServer(pipeline).connect(new StdioServerTransport());
