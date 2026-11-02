import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { createServer } from "../../src/adapters/mcp/server.js";
import { PToolPipeline } from "../../src/core/pipeline.js";
import { PPolicyEngine } from "../../src/core/policy.js";
import { PToolError } from "../../src/core/tool-error.js";
import { defineTool, PToolRegistry } from "../../src/core/tool-registry.js";

const tool = defineTool({
  name: "discord_get_test",
  toolset: "messages",
  description: "test",
  input: z.object({ channel_id: z.string() }),
  output: z.object({ result: z.string() }),
  annotations: {
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: true,
  },
  mutating: false,
  handler: async ({ channel_id }) => ({ result: channel_id }),
});
function setup(policy = new PPolicyEngine([], ["messages"], false)) {
  const registry = new PToolRegistry();
  registry.register(tool);
  return { registry, pipeline: new PToolPipeline(registry, policy, async () => "123") };
}
describe("core", () => {
  it("parses environment settings", () => {
    const p = PPolicyEngine.fromEnv({
      DISCORD_MCP_ALLOWED_GUILDS: "1, 2,",
      DISCORD_MCP_READ_ONLY: "true",
    });
    expect(p.allowedGuilds).toEqual(["1", "2"]);
    expect(p.toolsets).toEqual(["core", "messages"]);
    expect(p.readOnly).toBe(true);
  });
  it("rejects invalid safety settings", () => {
    for (const value of ["1", "TRUE"])
      expect(() => PPolicyEngine.fromEnv({ DISCORD_MCP_READ_ONLY: value })).toThrow(
        "DISCORD_MCP_READ_ONLY must be true or false",
      );
    for (const value of ["", "mesages"])
      expect(() => PPolicyEngine.fromEnv({ DISCORD_MCP_TOOLSETS: value })).toThrow(
        "Invalid DISCORD_MCP_TOOLSETS",
      );
    expect(PPolicyEngine.fromEnv({ DISCORD_MCP_READ_ONLY: "false" }).readOnly).toBe(false);
  });
  it("enforces policy and handles errors", async () => {
    const { pipeline, registry } = setup();
    expect(await pipeline.call(tool.name, { channel_id: "1" })).toEqual({
      ok: true,
      data: { result: "1" },
    });
    expect((await pipeline.call("missing", {})).ok).toBe(false);
    expect((await pipeline.call(tool.name, {})).ok).toBe(false);
    expect(() => registry.register(tool)).toThrow();
    expect(registry.list()).toHaveLength(1);
    expect(() => new PPolicyEngine([], [], false).check(tool)).toThrow("Toolset disabled");
    expect(() =>
      new PPolicyEngine([], ["messages"], true).check({ ...tool, mutating: true }),
    ).toThrow("Read-only");
    expect(() => new PPolicyEngine(["2"], ["messages"], false).check(tool, "1")).toThrow("Guild");
    expect(() => new PPolicyEngine(["2"], ["messages"], false).check(tool)).toThrow("Guild");
    new PPolicyEngine(["2"], ["messages"], false).check(tool, "2");
    const blocked = setup(new PPolicyEngine(["2"], ["messages"], false));
    expect((await blocked.pipeline.call(tool.name, { channel_id: "1" })).ok).toBe(false);
    const fail = new PToolRegistry();
    fail.register({
      ...tool,
      handler: async () => {
        throw new PToolError("bad", "discord", true, "retry", "op", { channel_id: "1" });
      },
    });
    const error = await new PToolPipeline(
      fail,
      new PPolicyEngine([], ["messages"], false),
      vi.fn(),
    ).call(tool.name, { channel_id: "1" });
    expect(error).toMatchObject({
      ok: false,
      error: { category: "discord", retryable: true, operation_id: "op" },
    });
    const unknown = new PToolRegistry();
    unknown.register({
      ...tool,
      handler: async () => {
        throw new Error("secret");
      },
    });
    expect(
      await new PToolPipeline(unknown, new PPolicyEngine([], ["messages"], false), vi.fn()).call(
        tool.name,
        { channel_id: "1" },
      ),
    ).not.toHaveProperty("error.message", "secret");
  });
  it("lists and calls tools over MCP", async () => {
    const { registry, pipeline } = setup();
    const server = createServer(registry, pipeline);
    const client = new Client({ name: "test", version: "1" });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
    expect((await client.listTools()).tools[0].name).toBe(tool.name);
    expect(
      (await client.callTool({ name: tool.name, arguments: { channel_id: "5" } }))
        .structuredContent,
    ).toEqual({ result: "5" });
    await client.close();
    await server.close();
  });
});
