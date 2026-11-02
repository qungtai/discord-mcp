import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { PPolicyEngine } from "../../src/core/policy.js";
import { redact } from "../../src/core/tool-error.js";
import { defineTool, PToolRegistry } from "../../src/core/tool-registry.js";
import { harness } from "../support/harness.js";

const probe = defineTool({
  name: "discord_probe_test",
  description: "test",
  operation_ids: ["test"],
  toolset: "core",
  credential: "bot",
  scope: { kind: "none" },
  effect: "read",
  idempotent: true,
  input: z.object({ fail: z.enum(["none", "plain", "string", "output"]).default("none") }),
  output: z.object({ correlation_id: z.string().min(1) }),
  execute: async ({ fail }, { progress, log, correlation_id }) => {
    await progress(1, 2);
    await log("info", "using Bot abc.def");
    if (fail === "plain") throw new Error("boom Bot secret.token");
    if (fail === "string") throw "raw";
    return { correlation_id: fail === "output" ? "" : correlation_id };
  },
});
function probeRegistry() {
  const registry = new PToolRegistry();
  registry.register(probe);
  return registry;
}

describe("policy configuration", () => {
  it("parses allowlists, default toolsets and read-only", () => {
    const p = PPolicyEngine.fromEnv({
      DISCORD_MCP_ALLOWED_GUILDS: "1, 2,",
      DISCORD_MCP_READ_ONLY: "true",
    });
    expect([p.allowedGuilds, p.toolsets, p.readOnly]).toEqual([
      ["1", "2"],
      ["core", "messages"],
      true,
    ]);
  });
  it.each(["1", "TRUE", "yes"])("fails closed on DISCORD_MCP_READ_ONLY=%s", (value) => {
    expect(() => PPolicyEngine.fromEnv({ DISCORD_MCP_READ_ONLY: value })).toThrow(
      "DISCORD_MCP_READ_ONLY must be true or false",
    );
  });
  it.each(["", "mesages"])("rejects DISCORD_MCP_TOOLSETS=%j", (value) => {
    expect(() => PPolicyEngine.fromEnv({ DISCORD_MCP_TOOLSETS: value })).toThrow(
      "Invalid DISCORD_MCP_TOOLSETS",
    );
  });
});

describe("registry", () => {
  it("loads every defineTool from src/operations without a hand-written list", async () => {
    expect((await PToolRegistry.load()).list().map((tool) => tool.name)).toEqual([
      "discord_send_message",
      "discord_edit_message",
      "discord_get_message",
      "discord_list_messages",
      "discord_download_attachment",
    ]);
  });
  it("rejects duplicate and badly named tools", () => {
    expect(() => probeRegistry().register(probe)).toThrow("Duplicate tool: discord_probe_test");
    expect(() => defineTool({ ...probe, name: "discord_Bad" as "discord_x" })).toThrow(
      "Invalid tool name: discord_Bad",
    );
  });
  it("advertises annotations derived from effect and idempotency", async () => {
    const { client } = await harness();
    const tools = (await client.listTools()).tools;
    expect(Object.fromEntries(tools.map((tool) => [tool.name, tool.annotations]))).toEqual({
      discord_send_message: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
      },
      discord_edit_message: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: false,
        openWorldHint: true,
      },
      discord_get_message: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
      discord_list_messages: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
      discord_download_attachment: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
      },
    });
  });
  it("advertises a real output schema per tool", async () => {
    const { client } = await harness();
    const tools = (await client.listTools()).tools;
    const schema = (name: string) => tools.find((tool) => tool.name === name)?.outputSchema;
    expect(schema("discord_list_messages")?.required).toEqual(["messages"]);
    expect(schema("discord_download_attachment")?.required).toEqual([
      "path",
      "filename",
      "size",
      "content_type",
      "sha256",
    ]);
  });
});

describe("pipeline over MCP", () => {
  it("returns SDK-level input errors in the structured shape", async () => {
    const { client } = await harness();
    const result = await client.callTool({
      name: "discord_get_message",
      arguments: { channel_id: "abc" },
    });
    expect(result.isError).toBe(true);
    expect(result.structuredContent).toMatchObject({
      error: {
        category: "validation",
        retryable: false,
        operation_id: "discord_get_message",
        message: "Invalid input: channel_id: Invalid; message_id: Required",
      },
    });
  });
  it("reports unknown tools as not_found", async () => {
    const { client } = await harness();
    const result = await client.callTool({ name: "discord_nope_tool", arguments: {} });
    expect(result.structuredContent).toMatchObject({
      error: { category: "not_found", message: "Unknown tool: discord_nope_tool" },
    });
  });
  it("sends progress and redacted log notifications with the call's correlation id", async () => {
    const { client } = await harness({ registry: probeRegistry() });
    const logs: unknown[] = [];
    client.fallbackNotificationHandler = async (notification) => {
      logs.push(notification);
    };
    const onprogress = vi.fn();
    const result = await client.callTool({ name: probe.name, arguments: {} }, undefined, {
      onprogress,
    });
    expect(onprogress).toHaveBeenCalledWith({ progress: 1, total: 2 });
    expect(logs).toEqual([
      expect.objectContaining({
        method: "notifications/message",
        params: { level: "info", logger: probe.name, data: "using Bot [redacted]" },
      }),
    ]);
    expect(result.structuredContent).toEqual({
      correlation_id: expect.stringMatching(/^[0-9a-f-]{36}$/),
    });
  });
  it("logs unknown errors redacted and returns a generic internal error", async () => {
    const stderr = vi.spyOn(process.stderr, "write").mockReturnValue(true);
    const { client } = await harness({ registry: probeRegistry() });
    const result = await client.callTool({ name: probe.name, arguments: { fail: "plain" } });
    const error = (result.structuredContent as { error: Record<string, string> }).error;
    expect(error).toMatchObject({
      category: "internal",
      retryable: false,
      message: "Operation failed",
    });
    const written = stderr.mock.calls.map(([chunk]) => String(chunk)).join("");
    expect(written).toContain(
      `[error] ${error.correlation_id} ${probe.name}: Error: boom Bot [redacted]`,
    );
    expect(written).not.toContain("secret.token");
    stderr.mockRestore();
  });
});

describe("pipeline without an MCP session", () => {
  it("skips progress and maps bad output and non-Error throws to internal", async () => {
    vi.spyOn(process.stderr, "write").mockReturnValue(true);
    const { pipeline } = await harness({ registry: probeRegistry() });
    expect((await pipeline.call(probe.name, {})).ok).toBe(true);
    expect(await pipeline.call(probe.name, { fail: "output" })).toMatchObject({
      ok: false,
      error: { category: "internal", message: "Invalid tool output" },
    });
    expect(await pipeline.call(probe.name, { fail: "string" })).toMatchObject({
      ok: false,
      error: { category: "internal", message: "Operation failed" },
    });
    vi.restoreAllMocks();
  });
  it("denies disabled toolsets", async () => {
    const { pipeline } = await harness({
      registry: probeRegistry(),
      policy: new PPolicyEngine([], ["messages"], false),
    });
    expect(await pipeline.call(probe.name, {})).toMatchObject({
      ok: false,
      error: { category: "policy", message: "Toolset disabled" },
    });
  });
});

describe("redact", () => {
  it("removes tokens, webhook secrets and configured secrets", () => {
    expect(
      redact("Bot a.b https://discord.com/api/webhooks/1/abc-DEF x-secret-x", ["x-secret-x"]),
    ).toBe("Bot [redacted] https://discord.com/api/webhooks/1/[redacted] [redacted]");
  });
});
