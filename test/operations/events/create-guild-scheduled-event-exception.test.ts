import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { PPolicyEngine } from "../../../src/core/policy.js";
import { errorOf, harness, json } from "../../support/harness.js";

beforeEach(() => {
  vi.spyOn(process.stderr, "write").mockReturnValue(true);
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const policy = new PPolicyEngine([], ["core", "messages", "events"], false);

const EXCEPTION = {
  event_id: "100",
  event_exception_id: "200",
  scheduled_start_time: "2026-11-06T18:00:00.000Z",
  scheduled_end_time: "2026-11-06T19:00:00.000Z",
  is_canceled: false,
};

it("creates an event exception with exact literals", async () => {
  const { client, request } = await harness({ policy, respond: () => EXCEPTION });
  const result = await client.callTool({
    name: "discord_create_guild_scheduled_event_exception",
    arguments: {
      guild_id: "10",
      guild_scheduled_event_id: "100",
      original_scheduled_start_time: "2026-11-05T18:00:00.000Z",
      scheduled_start_time: "2026-11-06T18:00:00.000Z",
      scheduled_end_time: "2026-11-06T19:00:00.000Z",
      is_canceled: false,
    },
  });
  expect(request().method).toBe("POST");
  expect(request().url).toBe(
    "https://discord.com/api/v10/guilds/10/scheduled-events/100/exceptions",
  );
  expect(JSON.parse(String(request().body))).toEqual({
    original_scheduled_start_time: "2026-11-05T18:00:00.000Z",
    scheduled_start_time: "2026-11-06T18:00:00.000Z",
    scheduled_end_time: "2026-11-06T19:00:00.000Z",
    is_canceled: false,
  });
  expect(result.structuredContent).toEqual({ guild_scheduled_event_exception: EXCEPTION });
});

it("passes allowlist check for allowed guild", async () => {
  const { client } = await harness({
    policy: new PPolicyEngine(["10"], ["events"], false),
    respond: () => EXCEPTION,
  });
  const result = await client.callTool({
    name: "discord_create_guild_scheduled_event_exception",
    arguments: {
      guild_id: "10",
      guild_scheduled_event_id: "100",
      original_scheduled_start_time: "2026-11-05T18:00:00.000Z",
    },
  });
  expect(result.structuredContent).toEqual({ guild_scheduled_event_exception: EXCEPTION });
});

it("denies allowlist check when guild is not allowed", async () => {
  const { client, makeRequest } = await harness({
    policy: new PPolicyEngine(["999"], ["events"], false),
  });
  const result = await client.callTool({
    name: "discord_create_guild_scheduled_event_exception",
    arguments: {
      guild_id: "10",
      guild_scheduled_event_id: "100",
      original_scheduled_start_time: "2026-11-05T18:00:00.000Z",
    },
  });
  expect(errorOf(result)).toMatchObject({
    category: "policy",
    message: "Guild is not allowed",
  });
  expect(makeRequest).not.toHaveBeenCalled();
});

it("maps a 403 to permission with required ManageEvents", async () => {
  const { client } = await harness({
    policy,
    makeRequest: async () => json({ message: "Missing Permissions", code: 50013 }, { status: 403 }),
  });
  const result = await client.callTool({
    name: "discord_create_guild_scheduled_event_exception",
    arguments: {
      guild_id: "10",
      guild_scheduled_event_id: "100",
      original_scheduled_start_time: "2026-11-05T18:00:00.000Z",
    },
  });
  expect(errorOf(result)).toMatchObject({
    category: "permission",
    status: 403,
    remediation: "Check the bot permissions; this tool needs ManageEvents",
  });
});

it("maps a 404 to not_found", async () => {
  const { client } = await harness({
    policy,
    makeRequest: async () =>
      json({ message: "Unknown Scheduled Event", code: 10070 }, { status: 404 }),
  });
  const result = await client.callTool({
    name: "discord_create_guild_scheduled_event_exception",
    arguments: {
      guild_id: "10",
      guild_scheduled_event_id: "100",
      original_scheduled_start_time: "2026-11-05T18:00:00.000Z",
    },
  });
  expect(errorOf(result)).toMatchObject({
    category: "not_found",
    status: 404,
  });
});
