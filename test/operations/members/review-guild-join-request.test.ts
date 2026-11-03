import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { PPolicyEngine } from "../../../src/core/policy.js";
import { PToolRegistry } from "../../../src/core/tool-registry.js";
import { reviewGuildJoinRequest } from "../../../src/operations/members/review-guild-join-request.js";
import { errorOf, harness, json } from "../../support/harness.js";

beforeEach(() => {
  vi.spyOn(process.stderr, "write").mockReturnValue(true);
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const ACTIONED_REQUEST = {
  id: "501",
  guild_id: "123",
  user_id: "701",
  application_status: "APPROVED" as const,
  created_at: "2026-01-01T00:00:00.000Z",
  reviewed_at: "2026-01-02T00:00:00.000Z",
  rejection_reason: null,
  user: { id: "701", username: "joiner1" },
};

it("approves or rejects a guild join request with body after the client accepts approval", async () => {
  const registry = new PToolRegistry();
  registry.register(reviewGuildJoinRequest);
  const { client, request } = await harness({
    registry,
    policy: new PPolicyEngine([], ["members"], false),
    respond: () => ACTIONED_REQUEST,
  });
  const result = await client.callTool({
    name: "discord_review_guild_join_request",
    arguments: {
      guild_id: "123",
      request_id: "501",
      action: "APPROVED",
    },
  });
  const req = request();
  expect(req.method).toBe("PATCH");
  expect(req.url).toBe("https://discord.com/api/v10/guilds/123/requests/501");
  expect(JSON.parse(String(req.body))).toEqual({
    action: "APPROVED",
  });
  expect(result.structuredContent).toEqual({
    join_request: ACTIONED_REQUEST,
  });
});

it("passes allowlist check when guild is allowed", async () => {
  const registry = new PToolRegistry();
  registry.register(reviewGuildJoinRequest);
  const { client, request } = await harness({
    registry,
    policy: new PPolicyEngine(["123"], ["members"], false),
    respond: () => ACTIONED_REQUEST,
  });
  const result = await client.callTool({
    name: "discord_review_guild_join_request",
    arguments: {
      guild_id: "123",
      request_id: "501",
      action: "APPROVED",
    },
  });
  expect(result.structuredContent).toEqual({
    join_request: ACTIONED_REQUEST,
  });
  expect(request()).toMatchObject({
    method: "PATCH",
    url: "https://discord.com/api/v10/guilds/123/requests/501",
  });
});

it("denies access when guild is not allowed", async () => {
  const registry = new PToolRegistry();
  registry.register(reviewGuildJoinRequest);
  const { client, makeRequest } = await harness({
    registry,
    policy: new PPolicyEngine(["999"], ["members"], false),
  });
  const result = await client.callTool({
    name: "discord_review_guild_join_request",
    arguments: {
      guild_id: "123",
      request_id: "501",
      action: "APPROVED",
    },
  });
  expect(errorOf(result)).toMatchObject({
    category: "policy",
    message: "Guild is not allowed",
  });
  expect(makeRequest).not.toHaveBeenCalled();
});

it("blocks execution in read-only mode", async () => {
  const registry = new PToolRegistry();
  registry.register(reviewGuildJoinRequest);
  const { pipeline, makeRequest } = await harness({
    registry,
    policy: new PPolicyEngine([], ["members"], true),
  });
  const result = await pipeline.call("discord_review_guild_join_request", {
    guild_id: "123",
    request_id: "501",
    action: "APPROVED",
  });
  expect(result).toMatchObject({
    error: { category: "policy", message: "Read-only mode" },
  });
  expect(makeRequest).not.toHaveBeenCalled();
});

it.each([
  ["invalid action STARTED", { guild_id: "123", request_id: "501", action: "STARTED" }],
  ["invalid action SUBMITTED", { guild_id: "123", request_id: "501", action: "SUBMITTED" }],
  [
    "rejection_reason > 160 chars",
    { guild_id: "123", request_id: "501", action: "REJECTED", rejection_reason: "r".repeat(161) },
  ],
])("validates input strictly: %s", async (_, args) => {
  const registry = new PToolRegistry();
  registry.register(reviewGuildJoinRequest);
  const { client, makeRequest } = await harness({
    registry,
    policy: new PPolicyEngine([], ["members"], false),
  });
  const result = await client.callTool({
    name: "discord_review_guild_join_request",
    arguments: args,
  });
  expect(errorOf(result)).toMatchObject({ category: "validation" });
  expect(makeRequest).not.toHaveBeenCalled();
});

it("handles 403 missing permissions error", async () => {
  const registry = new PToolRegistry();
  registry.register(reviewGuildJoinRequest);
  const { client } = await harness({
    registry,
    policy: new PPolicyEngine([], ["members"], false),
    makeRequest: async () => json({ message: "Missing Permissions", code: 50013 }, { status: 403 }),
  });
  const result = await client.callTool({
    name: "discord_review_guild_join_request",
    arguments: {
      guild_id: "123",
      request_id: "501",
      action: "APPROVED",
    },
  });
  expect(errorOf(result)).toMatchObject({
    category: "permission",
    status: 403,
    discord_code: 50013,
    remediation: "Check the bot permissions; this tool needs ManageGuild",
  });
});

it("handles 404 error", async () => {
  const registry = new PToolRegistry();
  registry.register(reviewGuildJoinRequest);
  const { client } = await harness({
    registry,
    policy: new PPolicyEngine([], ["members"], false),
    makeRequest: async () => json({ message: "Unknown Request", code: 10004 }, { status: 404 }),
  });
  const result = await client.callTool({
    name: "discord_review_guild_join_request",
    arguments: {
      guild_id: "123",
      request_id: "501",
      action: "APPROVED",
    },
  });
  expect(errorOf(result)).toMatchObject({
    category: "not_found",
    status: 404,
    discord_code: 10004,
    remediation: "Check the IDs in the request",
  });
});
