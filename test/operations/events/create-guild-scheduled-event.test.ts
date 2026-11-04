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
  channel_id: "20",
  name: "Stage Talk",
  scheduled_start_time: "2026-11-05T18:00:00.000Z",
  privacy_level: 2,
  status: 1,
  entity_type: 1,
};

it("creates a guild scheduled event with exact literals and reason", async () => {
  const { client, request } = await harness({ policy, respond: () => EVENT });
  const result = await client.callTool({
    name: "discord_create_guild_scheduled_event",
    arguments: {
      guild_id: "10",
      channel_id: "20",
      name: "Stage Talk",
      privacy_level: 2,
      scheduled_start_time: "2026-11-05T18:00:00.000Z",
      entity_type: 1,
      reason: "Weekly community schedule",
    },
  });
  expect(request().method).toBe("POST");
  expect(request().url).toBe("https://discord.com/api/v10/guilds/10/scheduled-events");
  expect(JSON.parse(String(request().body))).toEqual({
    channel_id: "20",
    name: "Stage Talk",
    privacy_level: 2,
    scheduled_start_time: "2026-11-05T18:00:00.000Z",
    entity_type: 1,
  });
  expect(new Headers(request().headers as HeadersInit).get("x-audit-log-reason")).toBe(
    "Weekly%20community%20schedule",
  );
  expect(result.structuredContent).toEqual({ guild_scheduled_event: EVENT });
});

it("passes allowlist check for allowed guild and channel", async () => {
  const { client, request } = await harness({
    policy: new PPolicyEngine(["10"], ["events"], false),
    makeRequest: async (url) => {
      if (String(url).endsWith("/channels/20")) {
        return json({ id: "20", guild_id: "10" });
      }
      return json(EVENT);
    },
  });
  const result = await client.callTool({
    name: "discord_create_guild_scheduled_event",
    arguments: {
      guild_id: "10",
      channel_id: "20",
      name: "Stage Talk",
      privacy_level: 2,
      scheduled_start_time: "2026-11-05T18:00:00.000Z",
      entity_type: 1,
    },
  });
  expect(result.structuredContent).toEqual({ guild_scheduled_event: EVENT });
  expect(request(0).url).toBe("https://discord.com/api/v10/channels/20");
  expect(request(1).url).toBe("https://discord.com/api/v10/guilds/10/scheduled-events");
});

it("denies allowlist check when channel belongs to a different unallowed guild", async () => {
  const { client, makeRequest } = await harness({
    policy: new PPolicyEngine(["10"], ["events"], false),
    makeRequest: async (url) => {
      if (String(url).endsWith("/channels/20")) {
        return json({ id: "20", guild_id: "999" });
      }
      return json(EVENT);
    },
  });
  const result = await client.callTool({
    name: "discord_create_guild_scheduled_event",
    arguments: {
      guild_id: "10",
      channel_id: "20",
      name: "Stage Talk",
      privacy_level: 2,
      scheduled_start_time: "2026-11-05T18:00:00.000Z",
      entity_type: 1,
    },
  });
  expect(errorOf(result)).toMatchObject({
    category: "policy",
    message: "Guild is not allowed",
  });
  // Channel was resolved, but POST to create event was blocked
  expect(makeRequest).toHaveBeenCalledTimes(1);
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

it("maps a 403 to permission with required ManageEvents, CreateEvents", async () => {
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
    remediation: "Check the bot permissions; this tool needs ManageEvents, CreateEvents",
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

it.each([
  {
    input: {
      guild_id: "10",
      name: "",
      scheduled_start_time: "2026-11-05T18:00:00.000Z",
      privacy_level: 2,
      entity_type: 3,
    },
    desc: "empty name",
  },
  {
    input: {
      guild_id: "10",
      name: "a".repeat(101),
      scheduled_start_time: "2026-11-05T18:00:00.000Z",
      privacy_level: 2,
      entity_type: 3,
    },
    desc: "name too long",
  },
  {
    input: {
      guild_id: "10",
      name: "Talk",
      scheduled_start_time: "not-a-datetime",
      privacy_level: 2,
      entity_type: 3,
    },
    desc: "bad start time",
  },
  {
    input: {
      guild_id: "10",
      name: "Talk",
      scheduled_start_time: "2026-11-05T18:00:00.000Z",
      privacy_level: 99,
      entity_type: 3,
    },
    desc: "invalid privacy level",
  },
  {
    input: {
      guild_id: "10",
      name: "Talk",
      scheduled_start_time: "2026-11-05T18:00:00.000Z",
      privacy_level: 2,
      entity_type: 99,
    },
    desc: "invalid entity type",
  },
  {
    input: {
      guild_id: "10",
      name: "Talk",
      scheduled_start_time: "2026-11-05T18:00:00.000Z",
      privacy_level: 2,
      entity_type: 3,
      entity_metadata: { extra: "field" },
    },
    desc: "strict entity_metadata violation",
  },
  {
    input: {
      guild_id: "10",
      name: "Talk",
      scheduled_start_time: "2026-11-05T18:00:00.000Z",
      privacy_level: 2,
      entity_type: 3,
      recurrence_rule: { start: "2026-11-05T18:00:00.000Z", frequency: 1, by_weekday: [8] },
    },
    desc: "recurrence_rule by_weekday out of range",
  },
  {
    input: {
      guild_id: "10",
      name: "Talk",
      scheduled_start_time: "2026-11-05T18:00:00.000Z",
      privacy_level: 2,
      entity_type: 3,
      recurrence_rule: {
        start: "2026-11-05T18:00:00.000Z",
        frequency: 1,
        by_n_weekday: [{ n: 6, day: 1 }],
      },
    },
    desc: "recurrence_rule by_n_weekday n out of range (>5)",
  },
  {
    input: {
      guild_id: "10",
      name: "Talk",
      scheduled_start_time: "2026-11-05T18:00:00.000Z",
      privacy_level: 2,
      entity_type: 3,
      recurrence_rule: {
        start: "2026-11-05T18:00:00.000Z",
        frequency: 1,
        by_month: [13],
      },
    },
    desc: "recurrence_rule by_month out of range (>12)",
  },
  {
    input: {
      guild_id: "10",
      name: "Talk",
      scheduled_start_time: "2026-11-05T18:00:00.000Z",
      privacy_level: 2,
      entity_type: 3,
      recurrence_rule: {
        start: "2026-11-05T18:00:00.000Z",
        frequency: 1,
        by_month_day: [32],
      },
    },
    desc: "recurrence_rule by_month_day out of range (>31)",
  },
  {
    input: {
      guild_id: "10",
      name: "Talk",
      scheduled_start_time: "2026-11-05T18:00:00.000Z",
      privacy_level: 2,
      entity_type: 3,
      recurrence_rule: {
        start: "2026-11-05T18:00:00.000Z",
        frequency: 1,
        by_year_day: [366],
      },
    },
    desc: "recurrence_rule by_year_day out of range (>365)",
  },
  {
    input: {
      guild_id: "10",
      name: "Talk",
      scheduled_start_time: "2026-11-05T18:00:00.000Z",
      privacy_level: 2,
      entity_type: 3,
      recurrence_rule: {
        start: "2026-11-05T18:00:00.000Z",
        frequency: 1,
        interval: 0,
      },
    },
    desc: "recurrence_rule interval out of range (<1)",
  },
  {
    input: {
      guild_id: "10",
      name: "Talk",
      scheduled_start_time: "2026-11-05T18:00:00.000Z",
      privacy_level: 2,
      entity_type: 3,
      recurrence_rule: {
        start: "2026-11-05T18:00:00.000Z",
        frequency: 1,
        count: 0,
      },
    },
    desc: "recurrence_rule count out of range (<1)",
  },
  {
    input: {
      guild_id: "10",
      name: "Talk",
      scheduled_start_time: "2026-11-05T18:00:00.000Z",
      privacy_level: 2,
      entity_type: 3,
      entity_metadata: {
        location: "a".repeat(101),
      },
    },
    desc: "entity_metadata location too long (>100)",
  },
])("validates input: $desc", async ({ input }) => {
  const { client, makeRequest } = await harness({ policy });
  const result = await client.callTool({
    name: "discord_create_guild_scheduled_event",
    arguments: input as Record<string, unknown>,
  });
  expect(errorOf(result)).toMatchObject({ category: "validation" });
  expect(makeRequest).not.toHaveBeenCalled();
});

// zod 4's z.iso.datetime({ offset: true }) requires seconds and range-checks the offset.
it("accepts an ISO 8601 start time with seconds and a valid offset only", async () => {
  const { client } = await harness({ policy, respond: () => EVENT });
  const call = (scheduled_start_time: string) =>
    client.callTool({
      name: "discord_create_guild_scheduled_event",
      arguments: {
        guild_id: "10",
        channel_id: "20",
        name: "Stage Talk",
        privacy_level: 2,
        entity_type: 1,
        scheduled_start_time,
      },
    });

  for (const value of ["2026-11-05T18:00:00Z", "2026-11-05T18:00:00+07:00"]) {
    expect((await call(value)).isError).not.toBe(true);
  }
  for (const value of ["2026-11-05T18:00Z", "2026-11-05T18:00:00+99:99"]) {
    expect(errorOf(await call(value))).toMatchObject({ category: "validation" });
  }
});
