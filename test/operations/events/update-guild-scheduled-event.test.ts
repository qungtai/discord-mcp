import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { PPolicyEngine } from "../../../src/core/policy.js";
import { PToolRegistry } from "../../../src/core/tool-registry.js";
import { updateGuildScheduledEvent } from "../../../src/operations/events/update-guild-scheduled-event.js";
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
  registry.register(updateGuildScheduledEvent);
  return registry;
};

const get = {
  guild_id: "10",
  guild_scheduled_event_id: "100",
  name: "Updated Name",
};

const EVENT = {
  id: "100",
  guild_id: "10",
  name: "Updated Name",
  status: 2,
};

it("refuses to run when the client cannot ask for approval", async () => {
  const { pipeline } = await harness({
    clientCapabilities: {},
    policy: new PPolicyEngine([], ["events"], false),
  });
  expect(await pipeline.call("discord_update_guild_scheduled_event", get)).toMatchObject({
    ok: false,
    error: {
      category: "policy",
      message: "This tool needs approval but the client does not support elicitation",
    },
  });
});

it("updates a guild scheduled event with body, reason and literal URL", async () => {
  const { client, request } = await harness({
    registry: toolRegistry(),
    policy: new PPolicyEngine([], ["events"], false),
    respond: () => EVENT,
  });
  const result = await client.callTool({
    name: "discord_update_guild_scheduled_event",
    arguments: {
      guild_id: "10",
      guild_scheduled_event_id: "100",
      name: "Updated Name",
      status: 2,
      reason: "Postponed",
    },
  });
  expect(request().method).toBe("PATCH");
  expect(request().url).toBe("https://discord.com/api/v10/guilds/10/scheduled-events/100");
  expect(JSON.parse(String(request().body))).toEqual({
    name: "Updated Name",
    status: 2,
  });
  expect(new Headers(request().headers as HeadersInit).get("x-audit-log-reason")).toBe("Postponed");
  expect(result.structuredContent).toEqual({ guild_scheduled_event: EVENT });
});

it("clears the channel with a literal channel_id null body under an allowlist", async () => {
  const { client, request, makeRequest } = await harness({
    registry: toolRegistry(),
    policy: new PPolicyEngine(["10"], ["events"], false),
    respond: () => EVENT,
  });
  const result = await client.callTool({
    name: "discord_update_guild_scheduled_event",
    arguments: { guild_id: "10", guild_scheduled_event_id: "100", channel_id: null },
  });
  expect(JSON.parse(String(request().body))).toEqual({ channel_id: null });
  expect(request().url).toBe("https://discord.com/api/v10/guilds/10/scheduled-events/100");
  // null clears the field, so no channel lookup is needed beyond the guild check.
  expect(makeRequest).toHaveBeenCalledTimes(1);
  expect(result.structuredContent).toEqual({ guild_scheduled_event: EVENT });
});

it("passes allowlist check for allowed guild and channel", async () => {
  const { client, request } = await harness({
    registry: toolRegistry(),
    policy: new PPolicyEngine(["10"], ["events"], false),
    makeRequest: async (url) => {
      if (String(url).endsWith("/channels/20")) {
        return json({ id: "20", guild_id: "10" });
      }
      return json(EVENT);
    },
  });
  const result = await client.callTool({
    name: "discord_update_guild_scheduled_event",
    arguments: {
      guild_id: "10",
      guild_scheduled_event_id: "100",
      channel_id: "20",
      name: "Updated Name",
    },
  });
  expect(result.structuredContent).toEqual({ guild_scheduled_event: EVENT });
  expect(request(0).url).toBe("https://discord.com/api/v10/channels/20");
  expect(request(1).url).toBe("https://discord.com/api/v10/guilds/10/scheduled-events/100");
});

it("denies allowlist check when channel belongs to a different unallowed guild", async () => {
  const { client, makeRequest } = await harness({
    registry: toolRegistry(),
    policy: new PPolicyEngine(["10"], ["events"], false),
    makeRequest: async (url) => {
      if (String(url).endsWith("/channels/20")) {
        return json({ id: "20", guild_id: "999" });
      }
      return json(EVENT);
    },
  });
  const result = await client.callTool({
    name: "discord_update_guild_scheduled_event",
    arguments: {
      guild_id: "10",
      guild_scheduled_event_id: "100",
      channel_id: "20",
      name: "Updated Name",
    },
  });
  expect(errorOf(result)).toMatchObject({
    category: "policy",
    message: "Guild is not allowed",
  });
  expect(makeRequest).toHaveBeenCalledTimes(1);
});

it("denies allowlist check when guild is not allowed", async () => {
  const { client, makeRequest } = await harness({
    registry: toolRegistry(),
    policy: new PPolicyEngine(["999"], ["events"], false),
  });
  const result = await client.callTool({
    name: "discord_update_guild_scheduled_event",
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
    name: "discord_update_guild_scheduled_event",
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
    makeRequest: async () =>
      json({ message: "Unknown Scheduled Event", code: 10070 }, { status: 404 }),
  });
  const result = await client.callTool({
    name: "discord_update_guild_scheduled_event",
    arguments: get,
  });
  expect(errorOf(result)).toMatchObject({
    category: "not_found",
    status: 404,
  });
});

it.each([
  { input: { ...get, name: "" }, desc: "empty name" },
  { input: { ...get, name: "a".repeat(101) }, desc: "name too long" },
  { input: { ...get, scheduled_start_time: "bad-date" }, desc: "invalid datetime" },
  { input: { ...get, privacy_level: 99 }, desc: "invalid privacy level" },
  { input: { ...get, status: 99 }, desc: "invalid status" },
  { input: { ...get, entity_type: 99 }, desc: "invalid entity type" },
])("validates input: $desc", async ({ input }) => {
  const { client, makeRequest } = await harness({
    registry: toolRegistry(),
    policy: new PPolicyEngine([], ["events"], false),
  });
  const result = await client.callTool({
    name: "discord_update_guild_scheduled_event",
    arguments: input as Record<string, unknown>,
  });
  expect(errorOf(result)).toMatchObject({ category: "validation" });
  expect(makeRequest).not.toHaveBeenCalled();
});
