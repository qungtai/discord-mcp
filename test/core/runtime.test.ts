import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { z } from "zod/v4";
import { PAttachmentService } from "../../src/adapters/files/attachment-service.js";
import { PToolPipeline } from "../../src/core/pipeline.js";
import { approvalNotice, PPolicyEngine } from "../../src/core/policy.js";
import type { DiscordRequest } from "../../src/core/ports.js";
import { createScopeResolver } from "../../src/core/scope.js";
import { redact } from "../../src/core/tool-error.js";
import {
  defineTool,
  PToolRegistry,
  type ToolDescriptor,
  type Toolset,
} from "../../src/core/tool-registry.js";
import { errorOf, harness, json, MESSAGE } from "../support/harness.js";

const probe = defineTool({
  name: "discord_probe_test",
  description: "test",
  operationIds: ["test"],
  toolset: "core",
  scope: "none",
  permissions: [],
  effect: "read",
  idempotent: true,
  input: z.object({ fail: z.enum(["none", "plain", "string", "output"]).default("none") }),
  output: z.object({ correlation_id: z.string().min(1) }),
  execute: async ({ fail }, { progress, log, correlationId }) => {
    await progress(1, 2);
    await log("info", "using Bot abc.defghijklmnopqrstuvwx");
    if (fail === "plain") throw new Error("boom Bot secret.token.0123456789abcdef");
    if (fail === "string") throw "raw";
    return { correlation_id: fail === "output" ? "" : correlationId };
  },
});
const create = (
  idempotent: boolean,
  effect: "write" | "destructive" = "write",
  approval?: boolean,
) =>
  defineTool({
    name: idempotent ? "discord_put_probe" : "discord_create_probe",
    description: "test",
    operationIds: ["test"],
    toolset: "core",
    scope: { channel: ["channel_id"] },
    permissions: ["ManageChannels"],
    effect,
    approval,
    idempotent,
    input: z.object({
      channel_id: z.string(),
      read_first: z.boolean().default(false),
      then_put: z.boolean().default(false),
    }),
    output: z.object({ channel: z.object({ id: z.string(), name: z.string() }) }),
    execute: async (p, { discord }) => {
      if (p.read_first) await discord({ method: "GET", route: `/channels/${p.channel_id}` });
      const channel = await discord<{ id: string; name: string }>({
        method: idempotent ? "PUT" : "POST",
        route: `/guilds/1/channels`,
        body: { name: "x" },
        reason: "probe reason",
      });
      if (p.then_put) await discord({ method: "PUT", route: `/channels/${channel.id}/x` });
      return { channel };
    },
  });
// A tool that scopes a guild and several channels, as pin or overwrite tools would.
const scoped = defineTool({
  ...probe,
  name: "discord_scoped_probe",
  scope: { guild: "guild_id", channel: ["channel_id", "target_ids"] },
  input: z.object({
    guild_id: z.string().optional(),
    channel_id: z.string(),
    target_ids: z.array(z.string()).default([]),
  }),
  output: z.object({}),
  execute: async (p, { discord }) => {
    for (const id of [p.channel_id, ...p.target_ids])
      await discord({ method: "PUT", route: `/channels/${id}/pins/1` });
    return {};
  },
});
// A webhook tool that also takes a guild, the shape the allowlist must not trust (P7).
const webhookTool = defineTool({
  ...probe,
  name: "discord_webhook_probe",
  scope: { guild: "guild_id", webhook: "webhook_id", invite: "code" },
  input: z.object({
    guild_id: z.string().optional(),
    webhook_id: z.string().optional(),
    code: z.string().optional(),
  }),
  output: z.object({}),
  execute: async (p, { discord }) => {
    await discord({ method: "DELETE", route: `/webhooks/${p.webhook_id}` });
    return {};
  },
});
const listing = defineTool({
  ...probe,
  name: "discord_listing_probe",
  input: z.object({}),
  output: z.object({ guilds: z.array(z.string()) }),
  execute: async (_, { allowsGuild }) => ({ guilds: ["200", "300"].filter(allowsGuild) }),
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
      DISCORD_MCP_ALLOW_DMS: "true",
    });
    expect([p.allowedGuilds, p.toolsets, p.readOnly, p.approval, p.allowDms]).toEqual([
      ["1", "2"],
      ["core", "messages", "reactions", "threads"],
      true,
      "elicitation",
      true,
    ]);
  });
  it("defaults DISCORD_MCP_ALLOW_DMS to false", () => {
    expect(PPolicyEngine.fromEnv({}).allowDms).toBe(false);
  });
  it.each(["1", "TRUE", "yes"])("fails closed on DISCORD_MCP_ALLOW_DMS=%s", (value) => {
    expect(() => PPolicyEngine.fromEnv({ DISCORD_MCP_ALLOW_DMS: value })).toThrow(
      "DISCORD_MCP_ALLOW_DMS must be true or false",
    );
  });
  it("parses DISCORD_MCP_APPROVAL=none and defaults to elicitation", () => {
    expect(PPolicyEngine.fromEnv({}).approval).toBe("elicitation");
    expect(PPolicyEngine.fromEnv({ DISCORD_MCP_APPROVAL: "none" }).approval).toBe("none");
    expect(() => PPolicyEngine.fromEnv({ DISCORD_MCP_APPROVAL: "invalid" })).toThrow(
      "DISCORD_MCP_APPROVAL must be elicitation or none",
    );
  });
  it("warns once at startup when DISCORD_MCP_APPROVAL=none", () => {
    expect(approvalNotice("none")).toBe(
      "DISCORD_MCP_APPROVAL=none: server-side approval for destructive tools is disabled\n",
    );
    expect(approvalNotice("elicitation")).toBeUndefined();
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
  it("fails when DISCORD_MCP_TOOLSETS names a toolset with no registered tools", () => {
    const registered = new Set<Toolset>(["core", "messages"]);
    expect(() => PPolicyEngine.fromEnv({ DISCORD_MCP_TOOLSETS: "core,voice" }, registered)).toThrow(
      "Toolset voice has no tools yet",
    );
    expect(() =>
      PPolicyEngine.fromEnv({ DISCORD_MCP_TOOLSETS: "core,invalid" }, registered),
    ).toThrow("Invalid DISCORD_MCP_TOOLSETS");
  });
});

describe("registry", () => {
  it("loads every defineTool from src/operations, sorted by name", async () => {
    const names = (await PToolRegistry.load()).list().map((tool) => tool.name);
    expect(names).toEqual([...names].sort());
    expect(names).toEqual(
      expect.arrayContaining([
        "discord_download_attachment",
        "discord_edit_message",
        "discord_get_message",
        "discord_list_messages",
        "discord_send_message",
      ]),
    );
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
    const annotations = Object.fromEntries(tools.map((tool) => [tool.name, tool.annotations]));
    expect(annotations.discord_download_attachment).toEqual(hints(false, false));
    expect(annotations.discord_edit_message).toEqual({
      ...hints(false, false),
      destructiveHint: true,
    });
    expect(annotations.discord_get_message).toEqual(hints(true, true));
    expect(annotations.discord_list_messages).toEqual(hints(true, true));
    expect(annotations.discord_send_message).toEqual(hints(false, false));
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
  it("advertises strict nested input objects and no generated defaults", async () => {
    const { client } = await harness();
    const loose: string[] = [];
    const visit = (schema: unknown, path: string): void => {
      if (typeof schema !== "object" || schema === null) return;
      const node = schema as Record<string, unknown>;
      if (node.properties && node.additionalProperties !== false) loose.push(path);
      for (const [key, child] of Object.entries(node)) visit(child, `${path}.${key}`);
    };
    const tools = (await client.listTools()).tools;
    for (const tool of tools) visit(tool.inputSchema, tool.name);
    expect(loose).toEqual([]);
    const second = await harness();
    expect((await second.client.listTools()).tools.map((t) => t.inputSchema)).toEqual(
      tools.map((t) => t.inputSchema),
    );
    const send = tools.find((t) => t.name === "discord_send_message");
    expect(send?.inputSchema.properties?.nonce).not.toHaveProperty("default");
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
    const readOnly = await harness({ policy: new PPolicyEngine([], ["core", "messages"], true) });
    const readOnlyNames = (await readOnly.client.listTools()).tools.map((t) => t.name);
    expect(readOnlyNames).toContain("discord_get_message");
    expect(readOnlyNames).toContain("discord_list_messages");
    expect(readOnlyNames).not.toContain("discord_send_message");
    expect(readOnlyNames).not.toContain("discord_edit_message");
    expect(readOnlyNames).not.toContain("discord_download_attachment");
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
      tool: "discord_get_message",
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
  it("denies disabled toolsets and requires approval for approval tools", async () => {
    const { pipeline } = await harness({
      registry: registryOf(probe, create(false, "destructive", true)),
      policy: new PPolicyEngine([], ["messages"], false),
    });
    expect(await pipeline.call(probe.name, {})).toMatchObject({
      ok: false,
      error: { category: "policy", message: "Toolset disabled" },
    });
    const { pipeline: core } = await harness({
      registry: registryOf(create(false, "destructive", true)),
    });
    expect(await core.call("discord_create_probe", { channel_id: "1" })).toMatchObject({
      ok: false,
      error: {
        category: "policy",
        message: "This tool needs approval but the client does not support elicitation",
      },
    });
    expect(core.tools().map((t) => t.name)).toEqual(["discord_create_probe"]);
    const { pipeline: optOut } = await harness({
      registry: registryOf(create(false, "destructive", false)),
      respond: () => ({ id: "5", name: "x" }),
    });
    expect(optOut.tools().map((t) => t.annotations.destructiveHint)).toEqual([true]);
    expect(await optOut.call("discord_create_probe", { channel_id: "1" })).toMatchObject({
      ok: true,
    });
  });
  it("fails when the tool's credential profile is not configured", async () => {
    const pipeline = new PToolPipeline(registryOf(probe), new PPolicyEngine([], ["core"], false), {
      credentials: {},
      files: new PAttachmentService([], ""),
      resolveScope: createScopeResolver(),
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
  it("reports a failure after a committed write as uncertain with the created ID", async () => {
    vi.spyOn(process.stderr, "write").mockReturnValue(true);
    const { pipeline } = await harness({
      registry: registryOf(create(false)),
      makeRequest: async (_, init) =>
        init.method === "POST"
          ? json({ id: "55", name: "x" })
          : json({ message: "Missing Permissions", code: 50013 }, { status: 403 }),
    });
    expect(
      await pipeline.call("discord_create_probe", { channel_id: "7", then_put: true }),
    ).toMatchObject({
      ok: false,
      error: {
        category: "uncertain",
        message: "Part of the change was applied",
        retryable: false,
        resource_ids: { channel_id: "7", id: "55" },
      },
    });
    vi.restoreAllMocks();
  });
  it("keeps a rate-limited non-idempotent write retryable", async () => {
    vi.spyOn(process.stderr, "write").mockReturnValue(true);
    const { pipeline } = await harness({
      registry: registryOf(create(false)),
      rateLimitWaitMs: 1,
      makeRequest: async () =>
        json(
          { message: "You are being rate limited.", retry_after: 3, global: false },
          { status: 429, headers: { "retry-after": "3" } },
        ),
    });
    expect(await pipeline.call("discord_create_probe", { channel_id: "7" })).toMatchObject({
      error: { category: "rate_limited", retryable: true },
    });
    vi.restoreAllMocks();
  });
  it("sends the audit log reason and writes one audit line per mutating call", async () => {
    const stderr = vi.spyOn(process.stderr, "write").mockReturnValue(true);
    const { pipeline, request } = await harness({
      registry: registryOf(create(false)),
      respond: () => ({ id: "55", name: "x" }),
    });
    const result = await pipeline.call("discord_create_probe", { channel_id: "7" });
    expect(new Headers(request().headers as HeadersInit).get("x-audit-log-reason")).toBe(
      "probe%20reason",
    );
    const lines = stderr.mock.calls.map(([c]) => String(c)).filter((c) => c.startsWith("[audit]"));
    expect(lines.map((line) => JSON.parse(line.slice(8)))).toEqual([
      {
        correlation_id: expect.any(String),
        tool: "discord_create_probe",
        credential: "bot",
        resource_ids: { channel_id: "7", id: "55" },
        outcome: "ok",
      },
    ]);
    expect(result.ok).toBe(true);
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
        makeRequest: async (url) =>
          json(String(url).endsWith("/channels/1") ? channel : { ...MESSAGE, channel_id: "1" }),
      });
      return {
        result: await pipeline.call("discord_get_message", { channel_id: "1", message_id: "2" }),
        request,
      };
    };
    const allowed = await call({ id: "1", guild_id: "200" });
    expect(allowed.result.ok).toBe(true);
    expect(allowed.request(0).url).toBe("https://discord.com/api/v10/channels/1");
    expect(allowed.request(1).url).toBe("https://discord.com/api/v10/channels/1/messages/2");
    for (const channel of [{ id: "1", guild_id: "300" }, { id: "1" }])
      expect((await call(channel)).result).toMatchObject({
        error: { category: "policy", message: "Guild is not allowed" },
      });
  });
  const guilds: Record<string, unknown> = {
    "/channels/1": { id: "1", guild_id: "200" },
    "/channels/9": { id: "9", guild_id: "999" },
    "/channels/8": { id: "8", type: 1 },
  };
  const scopedCall = async (input: Record<string, unknown>) => {
    const { pipeline, makeRequest } = await harness({
      registry: registryOf(scoped),
      policy: new PPolicyEngine(["200"], ["core"], false),
      makeRequest: async (url) => json(guilds[new URL(String(url)).pathname.slice(8)] ?? {}),
    });
    const result = await pipeline.call("discord_scoped_probe", input);
    return { result, methods: makeRequest.mock.calls.map(([, init]) => init.method) };
  };
  it.each([
    ["an allowed guild ID with a channel elsewhere", { guild_id: "200", channel_id: "9" }],
    ["a channel elsewhere in an array key", { channel_id: "1", target_ids: ["9"] }],
    ["a DM next to an allowed channel", { channel_id: "1", target_ids: ["8"] }],
  ])("denies %s before any write", async (_, input) => {
    const { result, methods } = await scopedCall(input);
    expect(result).toMatchObject({ error: { category: "policy" } });
    expect(methods.every((m) => m === "GET")).toBe(true);
  });
  it("allows channels in the allowed guild and looks each channel up once", async () => {
    let lookups = 0;
    const discord: DiscordRequest = async <T>() => {
      lookups++;
      return { guild_id: "200" } as T;
    };
    const resolve = createScopeResolver();
    await resolve({ channel: ["1"] }, discord);
    expect(await resolve({ guild: ["200"], channel: ["1"] }, discord)).toEqual({
      guildIds: ["200"],
      channelIds: ["1"],
      isDm: false,
      noGuild: false,
    });
    expect(lookups).toBe(1);
    const { result } = await scopedCall({ guild_id: "200", channel_id: "1", target_ids: ["1"] });
    expect(result).toEqual({ ok: true, data: {} });
  });
  const lookups: Record<string, unknown> = {
    "/webhooks/55": { id: "55", guild_id: "200", channel_id: "1" },
    "/webhooks/66": { id: "66", guild_id: "999", channel_id: "9" },
    "/invites/abc": { code: "abc", guild: { id: "200" }, channel: { id: "1" } },
    "/invites/dm": { code: "dm", channel: { id: "5" } },
    "/invites/..%2Fchannels%2F1": {},
  };
  const webhookCall = async (input: Record<string, unknown>) => {
    const { pipeline, makeRequest } = await harness({
      registry: registryOf(webhookTool, listing),
      policy: new PPolicyEngine(["200"], ["core"], false),
      makeRequest: async (url) => json(lookups[new URL(String(url)).pathname.slice(8)] ?? {}),
    });
    const result = await pipeline.call("discord_webhook_probe", input);
    return { result, requests: makeRequest.mock.calls.map(([u, i]) => `${i.method} ${u}`) };
  };
  it("resolves webhook IDs and invite codes to their guild (P6)", async () => {
    expect(await webhookCall({ webhook_id: "55" })).toEqual({
      result: { ok: true, data: {} },
      requests: [
        "GET https://discord.com/api/v10/webhooks/55",
        "DELETE https://discord.com/api/v10/webhooks/55",
      ],
    });
    expect((await webhookCall({ webhook_id: "55", code: "abc" })).result.ok).toBe(true);
    for (const input of [{ webhook_id: "66" }, { code: "dm" }])
      expect((await webhookCall(input)).result).toMatchObject({
        error: { category: "policy", message: "Guild is not allowed" },
      });
  });
  it("encodes invite codes in the lookup route (F3)", async () => {
    expect(await webhookCall({ code: "../channels/1" })).toMatchObject({
      result: { error: { category: "policy" } },
      requests: ["GET https://discord.com/api/v10/invites/..%2Fchannels%2F1"],
    });
  });
  it("does not let an allowed guild ID vouch for a webhook elsewhere (P7)", async () => {
    expect(await webhookCall({ guild_id: "200", webhook_id: "66" })).toMatchObject({
      result: { error: { category: "policy", message: "Guild is not allowed" } },
      requests: ["GET https://discord.com/api/v10/webhooks/66"],
    });
  });
  it("allows tools without a scope and lets them filter guild listings (P5)", async () => {
    const { pipeline, makeRequest } = await harness({
      registry: registryOf(listing),
      policy: new PPolicyEngine(["200"], ["core"], false),
    });
    expect(await pipeline.call("discord_listing_probe", {})).toEqual({
      ok: true,
      data: { guilds: ["200"] },
    });
    expect(makeRequest).not.toHaveBeenCalled();
    expect(new PPolicyEngine([], ["core"], false).allowsGuild("300")).toBe(true);
  });
  it("fails scope kinds it cannot check and a message without its channel", async () => {
    const discord: DiscordRequest = async <T>() => ({}) as T;
    const resolve = createScopeResolver();
    await expect(
      resolve({ role: ["1"] } as unknown as Parameters<typeof resolve>[0], discord),
    ).rejects.toMatchObject({
      category: "policy",
      message: "Scope kind role cannot be checked against the allowlist",
    });
    await expect(resolve({ message: ["1"] }, discord)).rejects.toMatchObject({
      message: "Scope kind message cannot be checked against the allowlist",
    });
  });
  it("looks up a repeated ID once and retries a failed lookup (n2)", async () => {
    let lookups = 0;
    const discord: DiscordRequest = async <T>() => {
      if (++lookups === 1) throw new Error("network");
      return { guild_id: "200" } as T;
    };
    const resolve = createScopeResolver();
    await expect(resolve({ channel: ["1"] }, discord)).rejects.toThrow("network");
    expect(await resolve({ channel: ["1", "1"] }, discord)).toEqual({
      guildIds: ["200"],
      channelIds: ["1"],
      isDm: false,
      noGuild: false,
    });
    expect(lookups).toBe(2);
  });
  it("enforces DM switch when guild allowlist is present", async () => {
    const dmChannel = { id: "8", type: 1 };
    const guildChannel = { id: "9", guild_id: "999" };
    const allowedGuildChannel = { id: "11", guild_id: "200" };
    const createDmTool = (await PToolRegistry.load()).get("discord_create_dm");
    const sendMessageTool = (await PToolRegistry.load()).get("discord_send_message");
    if (!createDmTool || !sendMessageTool) throw new Error("Tools missing");

    const multiChannelTool = defineTool({
      name: "discord_multi_channel_probe",
      description: "test multi channel scope",
      operationIds: ["test_multi"],
      toolset: "channels",
      scope: { channel: "channel_ids" },
      permissions: ["ViewChannel"],
      effect: "write",
      idempotent: false,
      input: z.object({ channel_ids: z.array(z.string()) }),
      output: z.object({ ok: z.boolean() }),
      execute: async () => ({ ok: true }),
    });

    const run = async (allowDms: boolean, tool: string, args: Record<string, unknown>) => {
      const customRegistry = new PToolRegistry();
      for (const t of (await PToolRegistry.load()).list()) customRegistry.register(t);
      customRegistry.register(multiChannelTool);

      const { pipeline, makeRequest } = await harness({
        registry: customRegistry,
        policy: new PPolicyEngine(
          ["200"],
          ["channels", "messages", "webhooks", "invites"],
          false,
          "elicitation",
          allowDms,
        ),
        makeRequest: async (url) => {
          const path = new URL(String(url)).pathname;
          if (path === "/api/v10/channels/8") return json(dmChannel);
          if (path === "/api/v10/channels/83") return json({ id: "83", type: 3 });
          if (path === "/api/v10/channels/9") return json(guildChannel);
          if (path === "/api/v10/channels/11") return json(allowedGuildChannel);
          if (path === "/api/v10/users/@me/channels") return json(dmChannel);
          if (path === "/api/v10/channels/8/messages") return json({ id: "10", channel_id: "8" });
          if (path === "/api/v10/channels/83/messages")
            return json({ id: "103", channel_id: "83" });
          if (path === "/api/v10/webhooks/55") return json({ id: "55", type: 3, guild_id: null });
          if (path === "/api/v10/webhooks/123456789")
            return json({ id: "123456789", guild_id: null });
          if (path === "/api/v10/invites/dm-invite") return json({ code: "dm-invite", type: 1 });
          if (path === "/api/v10/invites/friend") return json({ code: "friend", type: 2 });
          if (path === "/api/v10/invites/friend-invite")
            return json({ code: "friend-invite", type: 2 });
          return json({});
        },
      });
      const result = await pipeline.call(tool, args);
      return { result, calls: makeRequest.mock.calls.map(([u, i]) => `${i.method} ${u}`) };
    };

    // DMs off: refuses discord_create_dm and discord_send_message to DM channel with zero writes
    const dmCreateOff = await run(false, "discord_create_dm", { recipient_id: "1" });
    expect(dmCreateOff.result).toMatchObject({
      error: { category: "policy", message: "Guild is not allowed" },
    });
    expect(dmCreateOff.calls).toEqual([]);

    const dmSendOff = await run(false, "discord_send_message", { channel_id: "8", content: "hi" });
    expect(dmSendOff.result).toMatchObject({
      error: { category: "policy", message: "Guild is not allowed" },
    });
    expect(dmSendOff.calls).toEqual(["GET https://discord.com/api/v10/channels/8"]);

    // DMs on: lets both through
    const dmCreateOn = await run(true, "discord_create_dm", { recipient_id: "1" });
    expect(dmCreateOn.result).toEqual({ ok: true, data: { channel: dmChannel } });
    expect(dmCreateOn.calls).toEqual(["POST https://discord.com/api/v10/users/@me/channels"]);

    const dmSendOn = await run(true, "discord_send_message", { channel_id: "8", content: "hi" });
    expect(dmSendOn.result.ok).toBe(true);
    expect(dmSendOn.calls).toEqual([
      "GET https://discord.com/api/v10/channels/8",
      "POST https://discord.com/api/v10/channels/8/messages",
    ]);

    // DMs on still refuses a channel in a guild outside the allowlist
    const forbiddenGuildOn = await run(true, "discord_send_message", {
      channel_id: "9",
      content: "hi",
    });
    expect(forbiddenGuildOn.result).toMatchObject({
      error: { category: "policy", message: "Guild is not allowed" },
    });
    expect(forbiddenGuildOn.calls).toEqual(["GET https://discord.com/api/v10/channels/9"]);

    // DMs on: application webhook (guild_id null) and type 2 invite are refused
    const appWebhookRes = await run(true, "discord_get_webhook", { webhook_id: "123456789" });
    expect(appWebhookRes.result).toMatchObject({
      error: { category: "policy", message: "Guild is not allowed" },
    });

    const friendInviteRes = await run(true, "discord_get_invite", { code: "friend-invite" });
    expect(friendInviteRes.result).toMatchObject({
      error: { category: "policy", message: "Guild is not allowed" },
    });

    // Mixed {channel: [dmChannel, channelInGuild999]} with DMs on is refused with "Guild is not allowed" and no write
    const mixedForbidden = await run(true, "discord_multi_channel_probe", {
      channel_ids: ["8", "9"],
    });
    expect(mixedForbidden.result).toMatchObject({
      error: { category: "policy", message: "Guild is not allowed" },
    });

    // Mixed DM plus allowed guild with DMs on passes
    const mixedAllowed = await run(true, "discord_multi_channel_probe", {
      channel_ids: ["8", "11"],
    });
    expect(mixedAllowed.result).toEqual({ ok: true, data: { ok: true } });

    // Guild-less resource next to an allowed one is refused before any other check
    const updateWebhookNoGuild = await run(false, "discord_update_webhook", {
      webhook_id: "55",
      channel_id: "11",
      name: "x",
    });
    expect(updateWebhookNoGuild.result).toMatchObject({
      error: { category: "policy", message: "Guild is not allowed" },
    });
    expect(updateWebhookNoGuild.calls).toEqual([
      "GET https://discord.com/api/v10/webhooks/55",
      "GET https://discord.com/api/v10/channels/11",
    ]);

    const inviteNoGuildOff = await run(false, "discord_get_invite", {
      code: "friend",
      target_channel_id: "11",
    });
    expect(inviteNoGuildOff.result).toMatchObject({
      error: { category: "policy", message: "Guild is not allowed" },
    });
    expect(inviteNoGuildOff.calls).toEqual([
      "GET https://discord.com/api/v10/invites/friend",
      "GET https://discord.com/api/v10/channels/11",
    ]);

    const inviteNoGuildOn = await run(true, "discord_get_invite", {
      code: "friend",
      target_channel_id: "8",
    });
    expect(inviteNoGuildOn.result).toMatchObject({
      error: { category: "policy", message: "Guild is not allowed" },
    });
    expect(inviteNoGuildOn.calls).toEqual([
      "GET https://discord.com/api/v10/invites/friend",
      "GET https://discord.com/api/v10/channels/8",
    ]);

    // Group DM (type 3) and type 1 invite: allowed with DMs on, refused with DMs off
    const groupDmOff = await run(false, "discord_send_message", {
      channel_id: "83",
      content: "hi",
    });
    expect(groupDmOff.result).toMatchObject({
      error: { category: "policy", message: "Guild is not allowed" },
    });
    expect(groupDmOff.calls).toEqual(["GET https://discord.com/api/v10/channels/83"]);

    const groupDmOn = await run(true, "discord_send_message", {
      channel_id: "83",
      content: "hi",
    });
    expect(groupDmOn.result.ok).toBe(true);
    expect(groupDmOn.calls).toEqual([
      "GET https://discord.com/api/v10/channels/83",
      "POST https://discord.com/api/v10/channels/83/messages",
    ]);

    const inviteType1Off = await run(false, "discord_get_invite", { code: "dm-invite" });
    expect(inviteType1Off.result).toMatchObject({
      error: { category: "policy", message: "Guild is not allowed" },
    });
    expect(inviteType1Off.calls).toEqual(["GET https://discord.com/api/v10/invites/dm-invite"]);

    const inviteType1On = await run(true, "discord_get_invite", { code: "dm-invite" });
    expect(inviteType1On.result.ok).toBe(true);
    expect(inviteType1On.calls).toEqual([
      "GET https://discord.com/api/v10/invites/dm-invite",
      "GET https://discord.com/api/v10/invites/dm-invite",
    ]);
  });
  it("fails closed on a scope key that is not a string or string[]", async () => {
    const bad = defineTool({
      ...scoped,
      name: "discord_bad_probe",
      scope: { channel: "channel_id" },
      input: z.object({ channel_id: z.number() }),
    });
    vi.spyOn(process.stderr, "write").mockReturnValue(true);
    const { pipeline } = await harness({ registry: registryOf(bad) });
    expect(await pipeline.call("discord_bad_probe", { channel_id: 1 })).toMatchObject({
      error: { category: "internal" },
    });
    vi.restoreAllMocks();
  });
});

describe("redact", () => {
  it("removes token-shaped values, webhook secrets and configured secrets", () => {
    expect(
      redact("Bot abcdefghijklmnopqrst.uvw https://discord.com/api/webhooks/1/abc-DEF x-secret-x", [
        "x-secret-x",
      ]),
    ).toBe("Bot [redacted] https://discord.com/api/webhooks/1/[redacted] [redacted]");
  });
  it("keeps prose like 'Bot cleanup' and short words readable", () => {
    expect(redact("Bot cleanup after Bot a.b finished")).toBe("Bot cleanup after Bot a.b finished");
  });
});

describe("approval flow over MCP", () => {
  const approvalTool = defineTool({
    name: "discord_delete_probe",
    description: "test delete",
    operationIds: ["test_delete"],
    toolset: "core",
    scope: { channel: "channel_id" },
    permissions: ["ManageChannels"],
    effect: "destructive",
    approval: true,
    idempotent: true,
    input: z.object({
      channel_id: z.string(),
      reason: z.string().optional(),
    }),
    output: z.object({ deleted: z.boolean(), channel_id: z.string() }),
    execute: async (p, { discord }) => {
      await discord({ method: "DELETE", route: `/channels/${p.channel_id}` });
      return { deleted: true, channel_id: p.channel_id };
    },
  });

  it("runs tool and sends literal route, method and message when client accepts elicitation", async () => {
    let capturedMessage: string | undefined;
    let capturedSchema: unknown;
    const { client, request } = await harness({
      registry: registryOf(approvalTool),
      onElicit: async (req) => {
        capturedMessage = req.params.message;
        if ("requestedSchema" in req.params) capturedSchema = req.params.requestedSchema;
        return { action: "accept", content: { approve: true } };
      },
      respond: () => ({}),
    });
    const result = await client.callTool({
      name: "discord_delete_probe",
      arguments: { channel_id: "123", reason: "Cleanup run" },
    });
    expect(result.structuredContent).toEqual({ deleted: true, channel_id: "123" });
    expect(request().method).toBe("DELETE");
    expect(request().url).toBe("https://discord.com/api/v10/channels/123");
    expect(capturedMessage).toBe(
      'Approve discord_delete_probe?\nTargets: channel_id=123\nArguments: {"channel_id":"123","reason":"Cleanup run"}',
    );
    expect(capturedSchema).toEqual({
      type: "object",
      properties: { approve: { type: "boolean", title: "Approve this change" } },
      required: ["approve"],
    });
  });

  it("redacts only configured secrets and preserves plain text like 'Bot cleanup'", async () => {
    vi.stubEnv("DISCORD_TOKEN", "super-secret-token");
    let capturedMessage: string | undefined;
    const { client } = await harness({
      registry: registryOf(approvalTool),
      onElicit: async (req) => {
        capturedMessage = req.params.message;
        return { action: "accept", content: { approve: true } };
      },
      respond: () => ({}),
    });
    await client.callTool({
      name: "discord_delete_probe",
      arguments: { channel_id: "123", reason: "Bot cleanup token super-secret-token" },
    });
    expect(capturedMessage).toContain("Bot cleanup token [redacted]");
    expect(capturedMessage).not.toContain("super-secret-token");
    vi.unstubAllEnvs();
  });

  it("redacts token-shaped values in the approval message", async () => {
    let capturedMessage: string | undefined;
    const { client } = await harness({
      registry: registryOf(approvalTool),
      onElicit: async (req) => {
        capturedMessage = req.params.message;
        return { action: "accept", content: { approve: true } };
      },
      respond: () => ({}),
    });
    await client.callTool({
      name: "discord_delete_probe",
      arguments: {
        channel_id: "123",
        reason: "cleanup Bot abcdefghijklmnopqrst.uvwxyz with Bearer abcdefghijklmnopqrstuvwx",
      },
    });
    expect(capturedMessage).toContain("cleanup Bot [redacted] with Bearer [redacted]");
  });

  it("truncates a long string argument in the approval message", async () => {
    let capturedMessage: string | undefined;
    const { client } = await harness({
      registry: registryOf(approvalTool),
      onElicit: async (req) => {
        capturedMessage = req.params.message;
        return { action: "accept", content: { approve: true } };
      },
      respond: () => ({}),
    });
    const image = "A".repeat(600);
    await client.callTool({
      name: "discord_delete_probe",
      arguments: { channel_id: "123", reason: image },
    });
    expect(capturedMessage).toContain(`${"A".repeat(200)}…(600 chars)`);
    expect(capturedMessage).not.toContain("A".repeat(201));
  });

  it.each([
    ["declines", async () => ({ action: "decline" as const })],
    ["cancels", async () => ({ action: "cancel" as const })],
    [
      "accepts with approve false",
      async () => ({ action: "accept" as const, content: { approve: false } }),
    ],
    ["accepts with no content", async () => ({ action: "accept" as const })],
  ])(
    "fails with cancelled, retryable false and zero REST calls when client %s",
    async (_, onElicit) => {
      const { client, makeRequest } = await harness({
        registry: registryOf(approvalTool),
        onElicit,
      });
      const result = await client.callTool({
        name: "discord_delete_probe",
        arguments: { channel_id: "123" },
      });
      expect(errorOf(result)).toMatchObject({
        category: "cancelled",
        retryable: false,
        message: "Approval declined",
        remediation: "Ask the user before trying again",
      });
      expect(makeRequest).not.toHaveBeenCalled();
    },
  );

  it("fails with cancelled, retryable true and zero REST calls when elicitation rejects", async () => {
    const { client, makeRequest } = await harness({
      registry: registryOf(approvalTool),
      onElicit: async () => {
        throw new Error("elicitation timed out");
      },
    });
    const result = await client.callTool({
      name: "discord_delete_probe",
      arguments: { channel_id: "123" },
    });
    expect(errorOf(result)).toMatchObject({
      category: "cancelled",
      retryable: true,
      message: "Approval was not completed",
      remediation: "Retry and answer the approval prompt",
    });
    expect(makeRequest).not.toHaveBeenCalled();
  });

  it("fails with cancelled, retryable true and zero REST calls when elicitation aborts or cancels", async () => {
    const { pipeline, makeRequest } = await harness({
      registry: registryOf(approvalTool),
    });
    const abortError = new DOMException("This operation was aborted", "AbortError");
    const result = await pipeline.call(
      "discord_delete_probe",
      { channel_id: "123" },
      {
        approve: async () => {
          throw abortError;
        },
      },
    );
    expect(result).toMatchObject({
      ok: false,
      error: {
        category: "cancelled",
        retryable: true,
        message: "Approval was not completed",
        remediation: "Retry and answer the approval prompt",
      },
    });
    expect(makeRequest).not.toHaveBeenCalled();
  });

  it("fails with category policy and zero REST calls when client lacks elicitation capability or only supports URL", async () => {
    const noCap = await harness({ registry: registryOf(approvalTool), clientCapabilities: {} });
    const resNoCap = await noCap.client.callTool({
      name: "discord_delete_probe",
      arguments: { channel_id: "123" },
    });
    expect(errorOf(resNoCap)).toMatchObject({
      category: "policy",
      retryable: false,
      message: "This tool needs approval but the client does not support elicitation",
      remediation:
        "Use an MCP client that supports elicitation, or set DISCORD_MCP_APPROVAL=none to rely on the client's own tool approval",
    });
    expect(noCap.makeRequest).not.toHaveBeenCalled();

    const urlOnly = await harness({
      registry: registryOf(approvalTool),
      clientCapabilities: { elicitation: { url: {} } },
    });
    const resUrlOnly = await urlOnly.client.callTool({
      name: "discord_delete_probe",
      arguments: { channel_id: "123" },
    });
    expect(errorOf(resUrlOnly)).toMatchObject({
      category: "policy",
      retryable: false,
      message: "This tool needs approval but the client does not support elicitation",
    });
    expect(urlOnly.makeRequest).not.toHaveBeenCalled();
  });

  it("runs without elicitation request when DISCORD_MCP_APPROVAL=none", async () => {
    const elicitHandler = vi.fn();
    const { client, request } = await harness({
      registry: registryOf(approvalTool),
      policy: new PPolicyEngine([], ["core"], false, "none"),
      onElicit: elicitHandler,
      respond: () => ({}),
    });
    const result = await client.callTool({
      name: "discord_delete_probe",
      arguments: { channel_id: "123" },
    });
    expect(result.structuredContent).toEqual({ deleted: true, channel_id: "123" });
    expect(elicitHandler).not.toHaveBeenCalled();
    expect(request().method).toBe("DELETE");
    expect(request().url).toBe("https://discord.com/api/v10/channels/123");
  });

  it("enforces allowlist denial before any elicitation request", async () => {
    const elicitHandler = vi.fn();
    const { client, makeRequest } = await harness({
      registry: registryOf(approvalTool),
      policy: new PPolicyEngine(["200"], ["core"], false),
      onElicit: elicitHandler,
      makeRequest: async (url) =>
        json(String(url).endsWith("/channels/123") ? { id: "123", guild_id: "999" } : {}),
    });
    const result = await client.callTool({
      name: "discord_delete_probe",
      arguments: { channel_id: "123" },
    });
    expect(errorOf(result)).toMatchObject({
      category: "policy",
      message: "Guild is not allowed",
    });
    expect(elicitHandler).not.toHaveBeenCalled();
    expect(makeRequest).toHaveBeenCalledTimes(1);
    expect(makeRequest.mock.calls[0]?.[1]?.method).toBe("GET");
  });

  it("executes allowlist GET lookup, then elicitation, then DELETE in exact order on allowlisted guild", async () => {
    const order: string[] = [];
    const { client, makeRequest } = await harness({
      registry: registryOf(approvalTool),
      policy: new PPolicyEngine(["200"], ["core"], false),
      onElicit: async () => {
        order.push("elicit");
        return { action: "accept", content: { approve: true } };
      },
      makeRequest: async (_, init) => {
        order.push(init?.method ?? "UNKNOWN");
        return json({ id: "123", guild_id: "200" });
      },
    });
    const result = await client.callTool({
      name: "discord_delete_probe",
      arguments: { channel_id: "123" },
    });
    expect(result.structuredContent).toEqual({ deleted: true, channel_id: "123" });
    expect(order).toEqual(["GET", "elicit", "DELETE"]);
    expect(makeRequest.mock.calls.map(([, init]) => init?.method)).toEqual(["GET", "DELETE"]);
  });

  it("lists approval tools when allowed and hides them in read-only mode", async () => {
    const allowed = await harness({
      registry: registryOf(approvalTool),
      policy: new PPolicyEngine([], ["core"], false),
    });
    expect((await allowed.client.listTools()).tools.map((t) => t.name)).toEqual([
      "discord_delete_probe",
    ]);

    const readOnly = await harness({
      registry: registryOf(approvalTool),
      policy: new PPolicyEngine([], ["core"], true),
    });
    expect((await readOnly.client.listTools()).tools.map((t) => t.name)).toEqual([]);
  });
});
