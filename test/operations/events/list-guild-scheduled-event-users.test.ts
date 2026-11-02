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

const FIRST_USER = {
  guild_scheduled_event_id: "100",
  user_id: "40",
  guild_scheduled_event_exception_id: null,
  response: 1,
  user: { id: "40", username: "bob" },
};
const SECOND_USER = {
  guild_scheduled_event_id: "100",
  user_id: "50",
  guild_scheduled_event_exception_id: "201",
  response: 2,
  user: { id: "50", username: "alice" },
};

it("lists event users with query parameters, rich user fields, and paging cursor", async () => {
  const { client, request } = await harness({ policy, respond: () => [FIRST_USER, SECOND_USER] });
  const result = await client.callTool({
    name: "discord_list_guild_scheduled_event_users",
    arguments: {
      guild_id: "10",
      guild_scheduled_event_id: "100",
      limit: 2,
      with_member: true,
      after: "30",
    },
  });
  expect(request().method).toBe("GET");
  expect(request().url).toBe(
    "https://discord.com/api/v10/guilds/10/scheduled-events/100/users?limit=2&with_member=true&after=30",
  );
  expect(result.structuredContent).toEqual({
    users: [FIRST_USER, SECOND_USER],
    next_after: "50",
  });
});

it("passes allowlist check for allowed guild and derives cursor from user_id when user is absent", async () => {
  const userWithoutNestedUser = {
    guild_scheduled_event_id: "100",
    user_id: "40",
  };
  const { client } = await harness({
    policy: new PPolicyEngine(["10"], ["events"], false),
    respond: () => [userWithoutNestedUser],
  });
  const result = await client.callTool({
    name: "discord_list_guild_scheduled_event_users",
    arguments: {
      guild_id: "10",
      guild_scheduled_event_id: "100",
    },
  });
  expect(result.structuredContent).toEqual({
    users: [userWithoutNestedUser],
    next_after: "40",
  });
});

it("returns next_after as null when user list is empty", async () => {
  const { client } = await harness({
    policy,
    respond: () => [],
  });
  const result = await client.callTool({
    name: "discord_list_guild_scheduled_event_users",
    arguments: {
      guild_id: "10",
      guild_scheduled_event_id: "100",
    },
  });
  expect(result.structuredContent).toEqual({
    users: [],
    next_after: null,
  });
});

it("denies allowlist check when guild is not allowed", async () => {
  const { client, makeRequest } = await harness({
    policy: new PPolicyEngine(["999"], ["events"], false),
  });
  const result = await client.callTool({
    name: "discord_list_guild_scheduled_event_users",
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
    name: "discord_list_guild_scheduled_event_users",
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

it("rejects out of bounds limit", async () => {
  const { client } = await harness({ policy });
  for (const limit of [0, 101]) {
    const result = await client.callTool({
      name: "discord_list_guild_scheduled_event_users",
      arguments: {
        guild_id: "10",
        guild_scheduled_event_id: "100",
        limit,
      },
    });
    expect(result.isError).toBe(true);
  }
});
