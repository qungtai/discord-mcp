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
  name: "Community Hangout",
  scheduled_start_time: "2026-11-05T18:00:00.000Z",
  privacy_level: 2,
  status: 1,
  entity_type: 3,
};

it("gets a scheduled event with query parameters", async () => {
  const { client, request } = await harness({ policy, respond: () => EVENT });
  const result = await client.callTool({
    name: "discord_get_guild_scheduled_event",
    arguments: { guild_id: "10", guild_scheduled_event_id: "100", with_user_count: true },
  });
  expect(request().method).toBe("GET");
  expect(request().url).toBe(
    "https://discord.com/api/v10/guilds/10/scheduled-events/100?with_user_count=true",
  );
  expect(result.structuredContent).toEqual({ guild_scheduled_event: EVENT });
});

it("passes allowlist check for allowed guild", async () => {
  const { client } = await harness({
    policy: new PPolicyEngine(["10"], ["events"], false),
    respond: () => EVENT,
  });
  const result = await client.callTool({
    name: "discord_get_guild_scheduled_event",
    arguments: { guild_id: "10", guild_scheduled_event_id: "100" },
  });
  expect(result.structuredContent).toEqual({ guild_scheduled_event: EVENT });
});

it("denies allowlist check for unallowed guild", async () => {
  const { client, makeRequest } = await harness({
    policy: new PPolicyEngine(["999"], ["events"], false),
  });
  const result = await client.callTool({
    name: "discord_get_guild_scheduled_event",
    arguments: { guild_id: "10", guild_scheduled_event_id: "100" },
  });
  expect(errorOf(result)).toMatchObject({
    category: "policy",
    message: "Guild is not allowed",
  });
  expect(makeRequest).not.toHaveBeenCalled();
});

it("maps a 404 to not_found", async () => {
  const { client } = await harness({
    policy,
    makeRequest: async () =>
      json({ message: "Unknown Scheduled Event", code: 10070 }, { status: 404 }),
  });
  const result = await client.callTool({
    name: "discord_get_guild_scheduled_event",
    arguments: { guild_id: "10", guild_scheduled_event_id: "100" },
  });
  expect(errorOf(result)).toMatchObject({
    category: "not_found",
    status: 404,
  });
});
