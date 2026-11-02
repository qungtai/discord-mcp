import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { z } from "zod/v4";
import { PAttachmentService } from "../../src/adapters/files/attachment-service.js";
import { PToolPipeline } from "../../src/core/pipeline.js";
import { PPolicyEngine } from "../../src/core/policy.js";
import { resolveScope } from "../../src/core/scope.js";
import { redact } from "../../src/core/tool-error.js";
import { defineTool, PToolRegistry, type ToolDescriptor } from "../../src/core/tool-registry.js";
import { errorOf, harness, json } from "../support/harness.js";

const probe = defineTool({
  name: "discord_probe_test",
  description: "test",
  operation_ids: ["test"],
  toolset: "core",
  credential: "bot",
  scope: "none",
  permissions: [],
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
const create = (idempotent: boolean, effect: "write" | "destructive" = "write") =>
  defineTool({
    name: idempotent ? "discord_put_probe" : "discord_create_probe",
    description: "test",
    operation_ids: ["test"],
    toolset: "core",
    credential: "bot",
    scope: { channel: ["channel_id"] },
    permissions: ["ManageChannels"],
    effect,
    idempotent,
    input: z.object({ channel_id: z.string(), read_first: z.boolean().default(false) }),
    output: z.object({ channel: z.object({ id: z.string(), name: z.string() }) }),
    execute: async (p, { discord }) => {
      if (p.read_first) await discord({ method: "GET", route: `/channels/${p.channel_id}` });
      return {
        channel: await discord<{ id: string; name: string }>({
          method: idempotent ? "PUT" : "POST",
          route: `/guilds/1/channels`,
          body: { name: "x" },
        }),
      };
    },
  });
function registryOf(...tools: ToolDescriptor[]) {
  const registry = new PToolRegistry();
  for (const tool of tools) registry.register(tool);
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
  it("loads every defineTool from src/operations, sorted by name", async () => {
    expect((await PToolRegistry.load()).list().map((tool) => tool.name)).toEqual([
      "discord_download_attachment",
      "discord_edit_message",
      "discord_get_message",
      "discord_list_messages",
      "discord_send_message",
    ]);
  });
  it("fails when a directory has no tools", async () => {
    const dir = await mkdtemp(join(tmpdir(), "discord-mcp-"));
    await expect(PToolRegistry.load(dir)).rejects.toThrow(`No tools found in ${dir}`);
  });
  it("ignores a re-exported descriptor but rejects a different tool with the same name", () => {
    const registry = registryOf(probe, probe);
    expect(registry.list()).toEqual([probe]);
    expect(() => registry.register(defineTool({ ...probe, name: "discord_probe_test" }))).toThrow(
      "Duplicate tool: discord_probe_test",
    );
    expect(() => defineTool({ ...probe, name: "discord_Bad" as "discord_x" })).toThrow(
      "Invalid tool name: discord_Bad",
    );
  });
  it("type-checks scope keys against the input", () => {
    const spec = {
      ...probe,
      name: "discord_scope_test" as const,
      input: z.object({ channel_id: z.string() }),
    };
    defineTool({
      ...spec,
      scope: { channel: "channel_id" },
      execute: async () => ({ correlation_id: "x" }),
    });
    defineTool({
      ...spec,
      // @ts-expect-error chanel_id is not an input key
      scope: { channel: "chanel_id" },
      execute: async () => ({ correlation_id: "x" }),
    });
  });
  it("advertises annotations derived from effect and idempotency", async () => {
    const { client } = await harness();
    const tools = (await client.listTools()).tools;
    const hints = (readOnlyHint: boolean, idempotentHint: boolean) => ({
      readOnlyHint,
      destructiveHint: false,
      idempotentHint,
      openWorldHint: true,
    });
    expect(Object.fromEntries(tools.map((tool) => [tool.name, tool.annotations]))).toEqual({
      discord_download_attachment: hints(false, false),
      discord_edit_message: hints(false, false),
      discord_get_message: hints(true, true),
      discord_list_messages: hints(true, true),
      discord_send_message: hints(false, false),
    });
  });
  it("advertises inline output schemas and strict inputs", async () => {
    const { client } = await harness();
    const tools = (await client.listTools()).tools;
    const tool = (name: string) => tools.find((t) => t.name === name);
    expect(tool("discord_list_messages")?.outputSchema?.required).toEqual([
      "messages",
      "next_before",
      "next_after",
    ]);
    expect(tool("discord_get_message")?.inputSchema.additionalProperties).toBe(false);
    expect(JSON.stringify(tools)).not.toContain("$ref");
  });
  it("lists only tools the policy allows", async () => {
    const names = async (policy: PPolicyEngine) =>
      (
        await (
          await harness({ policy, registry: registryOf(probe, create(false)) })
        ).client.listTools()
      ).tools.map((t) => t.name);
    expect(await names(new PPolicyEngine([], ["messages"], false))).toEqual([]);
    expect(await names(new PPolicyEngine([], ["core"], true))).toEqual(["discord_probe_test"]);
    const all = (await (await harness()).client.listTools()).tools.map((t) => t.name);
    const readOnly = await harness({ policy: new PPolicyEngine([], ["core", "messages"], true) });
    expect((await readOnly.client.listTools()).tools.map((t) => t.name)).toEqual(
      all.filter((n) => n === "discord_get_message" || n === "discord_list_messages"),
    );
  });
});

describe("pipeline over MCP", () => {
  it("returns errors as text after listTools so the client does not reject them", async () => {
    const { client } = await harness();
    const result = await client.callTool({
      name: "discord_get_message",
      arguments: { channel_id: "abc" },
    });
    expect(errorOf(result)).toEqual({
      message:
        "Invalid input: channel_id: Expected a Discord snowflake; message_id: Invalid input: expected string, received undefined",
      category: "validation",
      retryable: false,
      remediation: "Fix the arguments to match the tool input schema",
      operation_id: "discord_get_message",
      correlation_id: expect.stringMatching(/^[0-9a-f-]{36}$/),
      resource_ids: {},
    });
  });
  it("rejects unknown keys instead of dropping them", async () => {
    const { client, makeRequest } = await harness();
    const result = await client.callTool({
      name: "discord_edit_message",
      arguments: { channel_id: "1", message_id: "2", content: "c", add_file: [] },
    });
    expect(errorOf(result)).toMatchObject({
      category: "validation",
      message: 'Invalid input: input: Unrecognized key: "add_file"',
    });
    expect(makeRequest).not.toHaveBeenCalled();
  });
  it("reports unknown tools as not_found", async () => {
    const { client } = await harness();
    const result = await client.callTool({ name: "discord_nope_tool", arguments: {} });
    expect(errorOf(result)).toMatchObject({
      category: "not_found",
      message: "Unknown tool: discord_nope_tool",
    });
  });
  it("sends progress and redacted log notifications", async () => {
    vi.spyOn(process.stderr, "write").mockReturnValue(true);
    const { client } = await harness({ registry: registryOf(probe) });
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
    vi.restoreAllMocks();
  });
  it("honours logging/setLevel", async () => {
    vi.spyOn(process.stderr, "write").mockReturnValue(true);
    const { client } = await harness({ registry: registryOf(probe) });
    const logs: unknown[] = [];
    client.fallbackNotificationHandler = async (notification) => {
      logs.push(notification);
    };
    await client.setLoggingLevel("error");
    await client.callTool({ name: probe.name, arguments: {} });
    expect(logs).toEqual([]);
    vi.restoreAllMocks();
  });
  it("logs unknown errors redacted and returns a generic internal error", async () => {
    const stderr = vi.spyOn(process.stderr, "write").mockReturnValue(true);
    const { client } = await harness({ registry: registryOf(probe) });
    const error = errorOf(
      await client.callTool({ name: probe.name, arguments: { fail: "plain" } }),
    );
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
    vi.restoreAllMocks();
  });
});

describe("pipeline without an MCP session", () => {
  it("maps bad output and non-Error throws to internal", async () => {
    vi.spyOn(process.stderr, "write").mockReturnValue(true);
    const { pipeline } = await harness({ registry: registryOf(probe) });
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
  it("denies disabled toolsets and destructive tools", async () => {
    const { pipeline } = await harness({
      registry: registryOf(probe, create(false, "destructive")),
      policy: new PPolicyEngine([], ["messages"], false),
    });
    expect(await pipeline.call(probe.name, {})).toMatchObject({
      ok: false,
      error: { category: "policy", message: "Toolset disabled" },
    });
    const { pipeline: core } = await harness({
      registry: registryOf(create(false, "destructive")),
    });
    expect(await core.call("discord_create_probe", { channel_id: "1" })).toMatchObject({
      ok: false,
      error: { category: "policy", message: "Destructive tools require approval support" },
    });
  });
  it("fails when the tool's credential profile is not configured", async () => {
    const pipeline = new PToolPipeline(registryOf(probe), new PPolicyEngine([], ["core"], false), {
      credentials: {},
      files: new PAttachmentService([], ""),
      resolveScope,
    });
    expect(await pipeline.call(probe.name, {})).toMatchObject({
      ok: false,
      error: { category: "policy", message: "Credential profile bot is not configured" },
    });
  });
});

describe("uncertain writes", () => {
  const failing = (error: () => unknown) => async () => {
    throw error();
  };
  it.each([
    ["HTTP 502", async () => json({}, { status: 502 })],
    ["network failure", failing(() => new TypeError("fetch failed"))],
    ["abort", failing(() => new DOMException("aborted", "AbortError"))],
  ])("reports %s on a non-idempotent write as uncertain without retrying", async (_, respond) => {
    vi.spyOn(process.stderr, "write").mockReturnValue(true);
    const { pipeline, makeRequest } = await harness({
      registry: registryOf(create(false)),
      makeRequest: respond,
    });
    expect(await pipeline.call("discord_create_probe", { channel_id: "7" })).toMatchObject({
      ok: false,
      error: {
        category: "uncertain",
        retryable: false,
        remediation: "Check the resource before retrying",
        resource_ids: { channel_id: "7" },
      },
    });
    expect(makeRequest).toHaveBeenCalledTimes(1);
    vi.restoreAllMocks();
  });
  it("keeps 5xx retryable for idempotent writes and for reads before the write", async () => {
    vi.spyOn(process.stderr, "write").mockReturnValue(true);
    const respond = async () => json({}, { status: 502 });
    const put = await harness({ registry: registryOf(create(true)), makeRequest: respond });
    expect(await put.pipeline.call("discord_put_probe", { channel_id: "7" })).toMatchObject({
      error: { category: "discord", retryable: true, status: 502 },
    });
    const post = await harness({ registry: registryOf(create(false)), makeRequest: respond });
    expect(
      await post.pipeline.call("discord_create_probe", { channel_id: "7", read_first: true }),
    ).toMatchObject({ error: { category: "discord", retryable: true, status: 502 } });
    vi.restoreAllMocks();
  });
  it("tells the agent not to repeat a write whose response fails the output schema", async () => {
    vi.spyOn(process.stderr, "write").mockReturnValue(true);
    const { pipeline } = await harness({
      registry: registryOf(create(false)),
      respond: () => ({ id: "55" }),
    });
    expect(await pipeline.call("discord_create_probe", { channel_id: "7" })).toMatchObject({
      ok: false,
      error: {
        category: "internal",
        retryable: false,
        message: "Discord accepted the request but the response did not match the output schema",
        resource_ids: { channel_id: "7", id: "55" },
      },
    });
    vi.restoreAllMocks();
  });
});

describe("guild allowlist", () => {
  it("resolves channels to guilds and denies DMs", async () => {
    const policy = new PPolicyEngine(["200"], ["core", "messages"], false);
    const call = async (channel: unknown) => {
      const { pipeline, request } = await harness({
        policy,
        makeRequest: async (url) => json(String(url).endsWith("/channels/1") ? channel : {}),
      });
      return {
        result: await pipeline.call("discord_get_message", { channel_id: "1", message_id: "2" }),
        request,
      };
    };
    const allowed = await call({ id: "1", guild_id: "200" });
    expect(allowed.request(0).url).toBe("https://discord.com/api/v10/channels/1");
    expect(allowed.request(1).url).toBe("https://discord.com/api/v10/channels/1/messages/2");
    for (const channel of [{ id: "1", guild_id: "300" }, { id: "1" }])
      expect((await call(channel)).result).toMatchObject({
        error: { category: "policy", message: "Guild is not allowed" },
      });
  });
  it("uses a guild ID from the input without a lookup", async () => {
    const discord = vi.fn();
    expect(await resolveScope({ guild: ["5"], channel: ["1"] }, discord)).toEqual({
      guildIds: ["5"],
      channelIds: ["1"],
      isDm: false,
    });
    expect(discord).not.toHaveBeenCalled();
  });
});

describe("redact", () => {
  it("removes tokens, webhook secrets and configured secrets", () => {
    expect(
      redact("Bot a.b https://discord.com/api/webhooks/1/abc-DEF x-secret-x", ["x-secret-x"]),
    ).toBe("Bot [redacted] https://discord.com/api/webhooks/1/[redacted] [redacted]");
  });
});
