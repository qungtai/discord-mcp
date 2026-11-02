import { REST, type RESTOptions, type ResponseLike } from "@discordjs/rest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { vi } from "vitest";
import { PDiscordRestAdapter } from "../../src/adapters/discord-rest/discord-rest.js";
import { PAttachmentService } from "../../src/adapters/files/attachment-service.js";
import { createServer } from "../../src/adapters/mcp/server.js";
import { PToolPipeline } from "../../src/core/pipeline.js";
import { PPolicyEngine } from "../../src/core/policy.js";
import { PToolRegistry } from "../../src/core/tool-registry.js";

export const MESSAGE = {
  id: "2",
  channel_id: "1",
  type: 0,
  author: { id: "9", username: "bot", bot: true },
  content: "hello",
  timestamp: "2026-11-03T00:00:00.000Z",
  edited_timestamp: null,
  attachments: [
    {
      id: "11",
      filename: "one.png",
      size: 5,
      url: "https://cdn.discordapp.com/one",
      content_type: "image/png",
      description: "old",
    },
    { id: "12", filename: "two.png", size: 3, url: "https://cdn.discordapp.com/two" },
  ],
  embeds: [],
};

export async function harness(
  options: {
    policy?: PPolicyEngine;
    files?: PAttachmentService;
    respond?: () => unknown;
    registry?: PToolRegistry;
  } = {},
) {
  // The DOM and undici ReadableStream typings differ; the runtime object is the same.
  const makeRequest = vi.fn<RESTOptions["makeRequest"]>(
    async () =>
      new Response(JSON.stringify(options.respond?.() ?? MESSAGE), {
        headers: { "content-type": "application/json" },
      }) as unknown as ResponseLike,
  );
  const rest = new PDiscordRestAdapter("test-token", new REST({ retries: 0, makeRequest }));
  const registry = options.registry ?? (await PToolRegistry.load());
  const pipeline = new PToolPipeline(
    registry,
    options.policy ?? new PPolicyEngine([], ["core", "messages"], false),
    { rest, files: options.files ?? new PAttachmentService([], "") },
    async () => "100",
  );
  const server = createServer(registry, pipeline);
  const client = new Client({ name: "test", version: "1" });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
  const request = (index = 0) => {
    const [url, init] = makeRequest.mock.calls[index] ?? [];
    return { url, method: init?.method, body: init?.body };
  };
  return { client, makeRequest, request, pipeline };
}
