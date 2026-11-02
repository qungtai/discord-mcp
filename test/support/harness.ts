import type { RESTOptions, ResponseLike } from "@discordjs/rest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import {
  type ClientCapabilities,
  type ElicitRequest,
  ElicitRequestSchema,
  type ElicitResult,
} from "@modelcontextprotocol/sdk/types.js";
import { vi } from "vitest";
import { PDiscordRestAdapter } from "../../src/adapters/discord-rest/discord-rest.js";
import { PAttachmentService } from "../../src/adapters/files/attachment-service.js";
import { createServer } from "../../src/adapters/mcp/server.js";
import { PToolPipeline } from "../../src/core/pipeline.js";
import { PPolicyEngine } from "../../src/core/policy.js";
import { createScopeResolver } from "../../src/core/scope.js";
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

export function json(body: unknown, init: ResponseInit = {}): ResponseLike {
  // The DOM and undici ReadableStream typings differ; the runtime object is the same.
  return new Response(JSON.stringify(body), {
    ...init,
    headers: { "content-type": "application/json", ...init.headers },
  }) as unknown as ResponseLike;
}

export async function harness(
  options: {
    policy?: PPolicyEngine;
    files?: PAttachmentService;
    respond?: () => unknown;
    makeRequest?: RESTOptions["makeRequest"];
    registry?: PToolRegistry;
    rateLimitWaitMs?: number;
    clientCapabilities?: ClientCapabilities;
    onElicit?: (request: ElicitRequest) => Promise<ElicitResult> | ElicitResult;
  } = {},
) {
  const makeRequest = vi.fn<RESTOptions["makeRequest"]>(
    options.makeRequest ?? (async () => json(options.respond?.() ?? MESSAGE)),
  );
  const bot = new PDiscordRestAdapter("test-token", {
    rateLimitWaitMs: options.rateLimitWaitMs,
    rest: { makeRequest },
  });
  const registry = options.registry ?? (await PToolRegistry.load());
  const pipeline = new PToolPipeline(
    registry,
    options.policy ?? new PPolicyEngine([], ["core", "messages"], false),
    {
      credentials: { bot },
      files: options.files ?? new PAttachmentService([], ""),
      resolveScope: createScopeResolver(),
    },
  );
  const server = createServer(pipeline);
  const client = new Client(
    { name: "test", version: "1" },
    options.clientCapabilities ? { capabilities: options.clientCapabilities } : undefined,
  );
  if (options.onElicit) {
    client.setRequestHandler(ElicitRequestSchema, options.onElicit);
  }
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
  await client.listTools();
  const request = (index = 0) => {
    const [url, init] = makeRequest.mock.calls[index] ?? [];
    return { url, method: init?.method, body: init?.body, headers: init?.headers };
  };
  return { client, makeRequest, request, pipeline };
}

// Error results carry the error as JSON text only (no structuredContent).
export function errorOf(result: unknown): Record<string, unknown> {
  const { isError, structuredContent, content } = result as {
    isError?: boolean;
    structuredContent?: unknown;
    content: { type: string; text: string }[];
  };
  if (!isError || structuredContent !== undefined) throw new Error("Expected a text-only error");
  return JSON.parse(content[0]?.text ?? "").error;
}
