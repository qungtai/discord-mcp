import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { toJsonSchemaCompat } from "@modelcontextprotocol/sdk/server/zod-json-schema-compat.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import type { PToolPipeline } from "../../core/pipeline.js";
import type { PToolRegistry } from "../../core/tool-registry.js";

// Low-level server so input validation runs in the pipeline and fails with the structured shape.
export function createServer(registry: PToolRegistry, pipeline: PToolPipeline): Server {
  const server = new Server(
    { name: "discord-mcp", version: "0.1.0" },
    { capabilities: { tools: {}, logging: {} } },
  );
  const tools = registry.list().map((tool) => ({
    name: tool.name,
    description: tool.description,
    inputSchema: toJsonSchemaCompat(tool.input) as { type: "object" },
    outputSchema: toJsonSchemaCompat(tool.output) as { type: "object" },
    annotations: tool.annotations,
  }));
  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools }));
  server.setRequestHandler(CallToolRequestSchema, async (request, extra) => {
    const result = await pipeline.call(request.params.name, request.params.arguments, {
      signal: extra.signal,
      progressToken: request.params._meta?.progressToken,
      notify: (notification) => extra.sendNotification(notification as never),
    });
    const structuredContent = result.ok ? result.data : { error: result.error };
    return {
      ...(result.ok ? {} : { isError: true }),
      content: [{ type: "text", text: JSON.stringify(structuredContent) }],
      structuredContent,
    };
  });
  return server;
}
