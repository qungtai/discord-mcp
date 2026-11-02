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

const COUNTS = {
  guild_scheduled_event_count: 42,
  guild_scheduled_event_exception_counts: {
    "201": 5,
    "202": 3,
  },
};

it("counts event users with query parameters", async () => {
  const { client, request } = await harness({ policy, respond: () => COUNTS });
  const result = await client.callTool({
    name: "discord_count_guild_scheduled_event_users",
    arguments: {
      guild_id: "10",
      guild_scheduled_event_id: "100",
      guild_scheduled_event_exception_ids: ["201", "202"],
    },
  });
  expect(request().method).toBe("GET");
  expect(request().url).toBe(
    "https://discord.com/api/v10/guilds/10/scheduled-events/100/users/counts?guild_scheduled_event_exception_ids=201%2C202",
  );
  expect(result.structuredContent).toEqual(COUNTS);
});

it("passes allowlist check for allowed guild", async () => {
  const { client } = await harness({
    policy: new PPolicyEngine(["10"], ["events"], false),
    respond: () => COUNTS,
  });
  const result = await client.callTool({
    name: "discord_count_guild_scheduled_event_users",
    arguments: {
      guild_id: "10",
      guild_scheduled_event_id: "100",
    },
  });
  expect(result.structuredContent).toEqual(COUNTS);
});

it("denies allowlist check when guild is not allowed", async () => {
  const { client, makeRequest } = await harness({
    policy: new PPolicyEngine(["999"], ["events"], false),
  });
  const result = await client.callTool({
    name: "discord_count_guild_scheduled_event_users",
    arguments: {
      guild_id: "10",
      guild_scheduled_event_id: "100",
    },
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
    name: "discord_count_guild_scheduled_event_users",
    arguments: {
      guild_id: "10",
      guild_scheduled_event_id: "100",
    },
  });
  expect(errorOf(result)).toMatchObject({
    category: "not_found",
    status: 404,
  });
});
