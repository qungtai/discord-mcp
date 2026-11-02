import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { PPolicyEngine } from "../../../src/core/policy.js";
import { PToolRegistry } from "../../../src/core/tool-registry.js";
import { updateGuildScheduledEventException } from "../../../src/operations/events/update-guild-scheduled-event-exception.js";
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
  registry.register(updateGuildScheduledEventException);
  return registry;
};

const get = {
  guild_id: "10",
  guild_scheduled_event_id: "100",
  exception_id: "200",
  is_canceled: true,
};

const EXCEPTION = {
  event_id: "100",
  event_exception_id: "200",
  scheduled_start_time: "2026-11-06T18:00:00.000Z",
  scheduled_end_time: "2026-11-06T19:00:00.000Z",
  is_canceled: true,
};

it("refuses to run when the client cannot ask for approval", async () => {
  const { pipeline } = await harness({
    clientCapabilities: {},
    policy: new PPolicyEngine([], ["events"], false),
  });
  expect(await pipeline.call("discord_update_guild_scheduled_event_exception", get)).toMatchObject({
    ok: false,
    error: {
      category: "policy",
      message: "This tool needs approval but the client does not support elicitation",
    },
  });
});

it("updates an event exception with exact literals", async () => {
  const { client, request } = await harness({
    registry: toolRegistry(),
    policy: new PPolicyEngine([], ["events"], false),
    respond: () => EXCEPTION,
  });
  const result = await client.callTool({
    name: "discord_update_guild_scheduled_event_exception",
    arguments: get,
  });
  expect(request().method).toBe("PATCH");
  expect(request().url).toBe(
    "https://discord.com/api/v10/guilds/10/scheduled-events/100/exceptions/200",
  );
  expect(JSON.parse(String(request().body))).toEqual({
    is_canceled: true,
  });
  expect(result.structuredContent).toEqual({ guild_scheduled_event_exception: EXCEPTION });
});

it("passes allowlist check for allowed guild", async () => {
  const { client } = await harness({
    registry: toolRegistry(),
    policy: new PPolicyEngine(["10"], ["events"], false),
    respond: () => EXCEPTION,
  });
  const result = await client.callTool({
    name: "discord_update_guild_scheduled_event_exception",
    arguments: get,
  });
  expect(result.structuredContent).toEqual({ guild_scheduled_event_exception: EXCEPTION });
});

it("denies allowlist check when guild is not allowed", async () => {
  const { client, makeRequest } = await harness({
    registry: toolRegistry(),
    policy: new PPolicyEngine(["999"], ["events"], false),
  });
  const result = await client.callTool({
    name: "discord_update_guild_scheduled_event_exception",
    arguments: get,
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
    name: "discord_update_guild_scheduled_event_exception",
    arguments: get,
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
    makeRequest: async () => json({ message: "Unknown Exception", code: 10071 }, { status: 404 }),
  });
  const result = await client.callTool({
    name: "discord_update_guild_scheduled_event_exception",
    arguments: get,
  });
  expect(errorOf(result)).toMatchObject({
    category: "not_found",
    status: 404,
  });
});
