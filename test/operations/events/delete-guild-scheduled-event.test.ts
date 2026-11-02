import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { PPolicyEngine } from "../../../src/core/policy.js";
import { PToolRegistry } from "../../../src/core/tool-registry.js";
import { deleteGuildScheduledEvent } from "../../../src/operations/events/delete-guild-scheduled-event.js";
import { errorOf, harness, json } from "../../support/harness.js";

beforeEach(() => {
  vi.spyOn(process.stderr, "write").mockReturnValue(true);
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const toolRegistry = () => {
  const registry = new PToolRegistry();
  registry.register(deleteGuildScheduledEvent);
  return registry;
};

const get = {
  guild_id: "10",
  guild_scheduled_event_id: "100",
  reason: "Event cancelled",
};

it("refuses to run when the client cannot ask for approval", async () => {
  const { pipeline } = await harness({
    clientCapabilities: {},
    policy: new PPolicyEngine([], ["events"], false),
  });
  expect(await pipeline.call("discord_delete_guild_scheduled_event", get)).toMatchObject({
    ok: false,
    error: {
      category: "policy",
      message: "This tool needs approval but the client does not support elicitation",
    },
  });
});

it("deletes a guild scheduled event and sends reason", async () => {
  const { client, request } = await harness({
    registry: toolRegistry(),
    policy: new PPolicyEngine([], ["events"], false),
    respond: () => undefined,
  });
  const result = await client.callTool({
    name: "discord_delete_guild_scheduled_event",
    arguments: get,
  });
  expect(request().method).toBe("DELETE");
  expect(request().url).toBe("https://discord.com/api/v10/guilds/10/scheduled-events/100");
  expect(new Headers(request().headers as HeadersInit).get("x-audit-log-reason")).toBe(
    "Event%20cancelled",
  );
  expect(result.structuredContent).toEqual({
    deleted: true,
    guild_id: "10",
    guild_scheduled_event_id: "100",
  });
});

it("passes allowlist check for allowed guild", async () => {
  const { client } = await harness({
    registry: toolRegistry(),
    policy: new PPolicyEngine(["10"], ["events"], false),
    respond: () => undefined,
  });
  const result = await client.callTool({
    name: "discord_delete_guild_scheduled_event",
    arguments: { guild_id: "10", guild_scheduled_event_id: "100" },
  });
  expect(result.structuredContent).toEqual({
    deleted: true,
    guild_id: "10",
    guild_scheduled_event_id: "100",
  });
});

it("denies allowlist check when guild is not allowed", async () => {
  const { client, makeRequest } = await harness({
    registry: toolRegistry(),
    policy: new PPolicyEngine(["999"], ["events"], false),
  });
  const result = await client.callTool({
    name: "discord_delete_guild_scheduled_event",
    arguments: { guild_id: "10", guild_scheduled_event_id: "100" },
  });
  expect(errorOf(result)).toMatchObject({
    category: "policy",
    message: "Guild is not allowed",
  });
  expect(makeRequest).not.toHaveBeenCalled();
});

it("maps a 403 to permission with required ManageEvents", async () => {
  const { client } = await harness({
    registry: toolRegistry(),
    policy: new PPolicyEngine([], ["events"], false),
    makeRequest: async () => json({ message: "Missing Permissions", code: 50013 }, { status: 403 }),
  });
  const result = await client.callTool({
    name: "discord_delete_guild_scheduled_event",
    arguments: { guild_id: "10", guild_scheduled_event_id: "100" },
  });
  expect(errorOf(result)).toMatchObject({
    category: "permission",
    status: 403,
    remediation: "Check the bot permissions; this tool needs ManageEvents",
  });
});

it("maps a 404 to not_found", async () => {
  const { client } = await harness({
    registry: toolRegistry(),
    policy: new PPolicyEngine([], ["events"], false),
    makeRequest: async () =>
      json({ message: "Unknown Scheduled Event", code: 10070 }, { status: 404 }),
  });
  const result = await client.callTool({
    name: "discord_delete_guild_scheduled_event",
    arguments: { guild_id: "10", guild_scheduled_event_id: "100" },
  });
  expect(errorOf(result)).toMatchObject({
    category: "not_found",
    status: 404,
  });
});
