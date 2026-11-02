import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { PPolicyEngine } from "../../../src/core/policy.js";
import { PToolRegistry } from "../../../src/core/tool-registry.js";
import { errorOf, harness, json } from "../../support/harness.js";

beforeEach(() => {
  vi.spyOn(process.stderr, "write").mockReturnValue(true);
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const get = {
  guild_id: "10",
  guild_scheduled_event_id: "100",
  exception_id: "200",
};

const toolRegistry = async () => {
  const base = await PToolRegistry.load();
  const tool = base.get("discord_delete_guild_scheduled_event_exception");
  if (!tool) throw new Error("Tool not found");
  const registry = new PToolRegistry();
  registry.register(tool);
  return registry;
};

it("refuses to run when the client cannot ask for approval", async () => {
  const { client } = await harness({
    clientCapabilities: {},
    policy: new PPolicyEngine([], ["events"], false),
  });
  const result = await client.callTool({
    name: "discord_delete_guild_scheduled_event_exception",
    arguments: get,
  });
  expect(errorOf(result)).toMatchObject({
    category: "policy",
    message: "This tool needs approval but the client does not support elicitation",
  });
});

it("deletes event exception via REST DELETE endpoint", async () => {
  const registry = await toolRegistry();
  const { client, request } = await harness({
    registry,
    policy: new PPolicyEngine([], ["events"], false),
    respond: () => undefined,
  });
  const result = await client.callTool({
    name: "discord_delete_guild_scheduled_event_exception",
    arguments: get,
  });
  expect(request().method).toBe("DELETE");
  expect(request().url).toBe(
    "https://discord.com/api/v10/guilds/10/scheduled-events/100/exceptions/200",
  );
  expect(result.structuredContent).toEqual({
    deleted: true,
    guild_id: "10",
    guild_scheduled_event_id: "100",
    exception_id: "200",
  });
});

it("passes allowlist check for allowed guild", async () => {
  const registry = await toolRegistry();
  const { client } = await harness({
    registry,
    policy: new PPolicyEngine(["10"], ["events"], false),
    respond: () => undefined,
  });
  const result = await client.callTool({
    name: "discord_delete_guild_scheduled_event_exception",
    arguments: get,
  });
  expect(result.structuredContent).toEqual({
    deleted: true,
    guild_id: "10",
    guild_scheduled_event_id: "100",
    exception_id: "200",
  });
});

it("denies allowlist check when guild is not allowed", async () => {
  const registry = await toolRegistry();
  const { client, makeRequest } = await harness({
    registry,
    policy: new PPolicyEngine(["999"], ["events"], false),
  });
  const result = await client.callTool({
    name: "discord_delete_guild_scheduled_event_exception",
    arguments: get,
  });
  expect(errorOf(result)).toMatchObject({
    category: "policy",
    message: "Guild is not allowed",
  });
  expect(makeRequest).not.toHaveBeenCalled();
});

it("maps a 403 to permission", async () => {
  const registry = await toolRegistry();
  const { client } = await harness({
    registry,
    policy: new PPolicyEngine([], ["events"], false),
    makeRequest: async () => json({ message: "Missing Permissions", code: 50013 }, { status: 403 }),
  });
  const result = await client.callTool({
    name: "discord_delete_guild_scheduled_event_exception",
    arguments: get,
  });
  expect(errorOf(result)).toMatchObject({
    category: "permission",
    status: 403,
  });
});

it("maps a 404 to not_found", async () => {
  const registry = await toolRegistry();
  const { client } = await harness({
    registry,
    policy: new PPolicyEngine([], ["events"], false),
    makeRequest: async () => json({ message: "Unknown Exception", code: 10071 }, { status: 404 }),
  });
  const result = await client.callTool({
    name: "discord_delete_guild_scheduled_event_exception",
    arguments: get,
  });
  expect(errorOf(result)).toMatchObject({
    category: "not_found",
    status: 404,
  });
});
