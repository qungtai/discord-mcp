import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { PToolPipeline } from "../../core/pipeline.js";
import type { PToolRegistry } from "../../core/tool-registry.js";

export function createServer(registry: PToolRegistry, pipeline: PToolPipeline): McpServer {
  const server = new McpServer({ name: "discord-mcp", version: "0.1.0" });
  for (const tool of registry.list()) {
    server.registerTool(
      tool.name,
      {
        description: tool.description,
        inputSchema: tool.input,
        outputSchema: tool.output,
        annotations: tool.annotations,
      },
      async (input) => {
        const result = await pipeline.call(tool.name, input);
        if (!result.ok)
          return {
            isError: true,
            content: [{ type: "text", text: JSON.stringify(result.error) }],
            structuredContent: { error: result.error },
          };
        return {
          content: [{ type: "text", text: JSON.stringify(result.data) }],
          structuredContent: result.data,
        };
      },
    );
  }
  return server;
}
