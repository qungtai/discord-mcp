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

const EVENT = {
  id: "100",
  guild_id: "10",
  name: "Stage Talk",
  scheduled_start_time: "2026-11-05T18:00:00.000Z",
  privacy_level: 2,
  status: 1,
  entity_type: 3,
};

it("creates a guild scheduled event with exact literals and reason", async () => {
  const { client, request } = await harness({ policy, respond: () => EVENT });
  const result = await client.callTool({
    name: "discord_create_guild_scheduled_event",
    arguments: {
      guild_id: "10",
      name: "Stage Talk",
      privacy_level: 2,
      scheduled_start_time: "2026-11-05T18:00:00.000Z",
      entity_type: 3,
      reason: "Weekly community schedule",
    },
  });
  expect(request().method).toBe("POST");
  expect(request().url).toBe("https://discord.com/api/v10/guilds/10/scheduled-events");
  expect(JSON.parse(String(request().body))).toEqual({
    name: "Stage Talk",
    privacy_level: 2,
    scheduled_start_time: "2026-11-05T18:00:00.000Z",
    entity_type: 3,
  });
  expect(new Headers(request().headers as HeadersInit).get("x-audit-log-reason")).toBe(
    "Weekly%20community%20schedule",
  );
  expect(result.structuredContent).toEqual({ guild_scheduled_event: EVENT });
});

it("passes allowlist check for allowed guild and channel", async () => {
  const { client } = await harness({
    policy: new PPolicyEngine(["10"], ["events"], false),
    respond: () => EVENT,
  });
  const result = await client.callTool({
    name: "discord_create_guild_scheduled_event",
    arguments: {
      guild_id: "10",
      name: "Stage Talk",
      privacy_level: 2,
      scheduled_start_time: "2026-11-05T18:00:00.000Z",
      entity_type: 3,
    },
  });
  expect(result.structuredContent).toEqual({ guild_scheduled_event: EVENT });
});

it("denies allowlist check when guild is not allowed", async () => {
  const { client, makeRequest } = await harness({
    policy: new PPolicyEngine(["999"], ["events"], false),
  });
  const result = await client.callTool({
    name: "discord_create_guild_scheduled_event",
    arguments: {
      guild_id: "10",
      name: "Stage Talk",
      privacy_level: 2,
      scheduled_start_time: "2026-11-05T18:00:00.000Z",
      entity_type: 3,
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
    name: "discord_create_guild_scheduled_event",
    arguments: {
      guild_id: "10",
      name: "Stage Talk",
      privacy_level: 2,
      scheduled_start_time: "2026-11-05T18:00:00.000Z",
      entity_type: 3,
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
    makeRequest: async () => json({ message: "Unknown Channel", code: 10003 }, { status: 404 }),
  });
  const result = await client.callTool({
    name: "discord_create_guild_scheduled_event",
    arguments: {
      guild_id: "10",
      name: "Stage Talk",
      privacy_level: 2,
      scheduled_start_time: "2026-11-05T18:00:00.000Z",
      entity_type: 3,
    },
  });
  expect(errorOf(result)).toMatchObject({
    category: "not_found",
    status: 404,
  });
});
