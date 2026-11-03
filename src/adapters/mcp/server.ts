import { createRequire } from "node:module";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { toJsonSchemaCompat } from "@modelcontextprotocol/sdk/server/zod-json-schema-compat.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import type { PToolPipeline } from "../../core/pipeline.js";

const require = createRequire(import.meta.url);
const pkg = require("../../../package.json") as { version: string };

// Low-level server so input validation runs in the pipeline and fails with the structured shape.
export function createServer(pipeline: PToolPipeline): Server {
  const server = new Server(
    { name: "discord-mcp", version: pkg.version },
    { capabilities: { tools: {}, logging: {} } },
  );
  const tools = pipeline.tools().map((tool) => ({
    name: tool.name,
    description: tool.description,
    inputSchema: toJsonSchemaCompat(tool.input) as { type: "object" },
    outputSchema: toJsonSchemaCompat(tool.output) as { type: "object" },
    annotations: tool.annotations,
  }));
  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools }));
  server.setRequestHandler(CallToolRequestSchema, async (request, extra) => {
    const progressToken = request.params._meta?.progressToken;
    const hasElicitation = Boolean(server.getClientCapabilities()?.elicitation?.form);
    const approve = hasElicitation
      ? async (message: string) => {
          const result = await server.elicitInput(
            {
              message,
              requestedSchema: {
                type: "object",
                properties: { approve: { type: "boolean", title: "Approve this change" } },
                required: ["approve"],
              },
            },
            {
              signal: extra.signal,
              relatedRequestId: extra.requestId,
              timeout: 10 * 60_000,
            },
          );
          return result.action === "accept" && result.content?.approve === true;
        }
      : undefined;
    const result = await pipeline.call(request.params.name, request.params.arguments, {
      signal: extra.signal,
      approve,
      progress: async (progress, total) => {
        if (progressToken !== undefined)
          await extra.sendNotification({
            method: "notifications/progress",
            params: { progressToken, progress, total },
          });
      },
      log: (level, data) =>
        server.sendLoggingMessage({ level, logger: request.params.name, data }, extra.sessionId),
    });
    // Clients validate structuredContent against outputSchema even on errors, so errors are text only.
    if (!result.ok)
      return {
        isError: true,
        content: [{ type: "text", text: JSON.stringify({ error: result.error }) }],
      };
    return {
      content: [{ type: "text", text: JSON.stringify(result.data) }],
      structuredContent: result.data,
    };
  });
  return server;
}
