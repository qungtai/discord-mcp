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

const JOIN_REQUEST_A = {
  id: "501",
  guild_id: "123",
  user_id: "701",
  application_status: "SUBMITTED" as const,
  created_at: "2026-01-01T00:00:00.000Z",
  reviewed_at: null,
  rejection_reason: null,
  user: { id: "701", username: "joiner1" },
};

const JOIN_REQUEST_B = {
  id: "502",
  guild_id: "123",
  user_id: "702",
  application_status: "SUBMITTED" as const,
  created_at: "2026-01-02T00:00:00.000Z",
  reviewed_at: null,
  rejection_reason: null,
  user: { id: "702", username: "joiner2" },
};

it("lists guild join requests with query params and cursors", async () => {
  const { client, request } = await harness({
    policy: new PPolicyEngine([], ["members"], false),
    respond: () => ({
      total: 2,
      guild_join_requests: [JOIN_REQUEST_A, JOIN_REQUEST_B],
    }),
  });
  const result = await client.callTool({
    name: "discord_get_guild_join_requests",
    arguments: {
      guild_id: "123",
      status: "SUBMITTED",
      limit: 10,
      after: "500",
    },
  });
  expect(request()).toMatchObject({
    method: "GET",
    url: "https://discord.com/api/v10/guilds/123/requests?status=SUBMITTED&limit=10&after=500",
  });
  expect(result.structuredContent).toEqual({
    guild_join_requests: [JOIN_REQUEST_A, JOIN_REQUEST_B],
    total: 2,
    next_before: "502",
    next_after: "501",
  });
});

it("passes allowlist check when guild is allowed", async () => {
  const { client, request } = await harness({
    policy: new PPolicyEngine(["123"], ["members"], false),
    respond: () => ({
      guild_join_requests: [JOIN_REQUEST_A],
    }),
  });
  const result = await client.callTool({
    name: "discord_get_guild_join_requests",
    arguments: { guild_id: "123" },
  });
  expect(result.structuredContent).toEqual({
    guild_join_requests: [JOIN_REQUEST_A],
    next_before: "501",
    next_after: "501",
  });
  expect(request()).toMatchObject({
    method: "GET",
    url: "https://discord.com/api/v10/guilds/123/requests",
  });
});

it("denies access when guild is not allowed", async () => {
  const { client, makeRequest } = await harness({
    policy: new PPolicyEngine(["999"], ["members"], false),
  });
  const result = await client.callTool({
    name: "discord_get_guild_join_requests",
    arguments: { guild_id: "123" },
  });
  expect(errorOf(result)).toMatchObject({
    category: "policy",
    message: "Guild is not allowed",
  });
  expect(makeRequest).not.toHaveBeenCalled();
});

it.each([
  ["invalid status", { guild_id: "123", status: "INVALID_STATUS" }],
  ["limit < 1", { guild_id: "123", limit: 0 }],
  ["limit > 100", { guild_id: "123", limit: 101 }],
])("validates input strictly: %s", async (_, args) => {
  const { client, makeRequest } = await harness({
    policy: new PPolicyEngine([], ["members"], false),
  });
  const result = await client.callTool({
    name: "discord_get_guild_join_requests",
    arguments: args,
  });
  expect(errorOf(result)).toMatchObject({ category: "validation" });
  expect(makeRequest).not.toHaveBeenCalled();
});

it("handles 403 missing permissions error", async () => {
  const { pipeline } = await harness({
    policy: new PPolicyEngine([], ["members"], false),
    makeRequest: async () => json({ message: "Missing Permissions", code: 50013 }, { status: 403 }),
  });
  expect(await pipeline.call("discord_get_guild_join_requests", { guild_id: "123" })).toMatchObject(
    {
      ok: false,
      error: {
        category: "permission",
        status: 403,
        discord_code: 50013,
        remediation: "Check the bot permissions; this tool needs ManageGuild",
      },
    },
  );
});

it("handles 404 error", async () => {
  const { pipeline } = await harness({
    policy: new PPolicyEngine([], ["members"], false),
    makeRequest: async () => json({ message: "Unknown Guild", code: 10004 }, { status: 404 }),
  });
  expect(await pipeline.call("discord_get_guild_join_requests", { guild_id: "123" })).toMatchObject(
    {
      ok: false,
      error: {
        category: "not_found",
        status: 404,
        discord_code: 10004,
        remediation: "Check the IDs in the request",
      },
    },
  );
});
