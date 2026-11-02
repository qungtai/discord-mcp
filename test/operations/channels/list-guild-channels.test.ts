import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { PPolicyEngine } from "../../../src/core/policy.js";
import { errorOf, harness, json } from "../../support/harness.js";

beforeEach(() => {
  vi.spyOn(process.stderr, "write").mockReturnValue(true);
});
afterEach(() => {
  vi.restoreAllMocks();
});

const CHANNELS = [
  {
    id: "100",
    type: 0,
    guild_id: "200",
    name: "general",
    parent_id: null,
    position: 0,
    topic: "General chat",
  },
  {
    id: "101",
    type: 2,
    guild_id: "200",
    name: "voice",
    parent_id: null,
    position: 1,
    topic: null,
  },
];

it("lists channels in a guild", async () => {
  const { client, request } = await harness({
    policy: new PPolicyEngine([], ["channels"], false),
    respond: () => CHANNELS,
  });
  const result = await client.callTool({
    name: "discord_list_guild_channels",
    arguments: { guild_id: "200" },
  });
  expect(request()).toMatchObject({
    method: "GET",
    url: "https://discord.com/api/v10/guilds/200/channels",
  });
  expect(result.structuredContent).toEqual({ channels: CHANNELS });
});

it("passes allowlist check when guild is allowed", async () => {
  const { client, request } = await harness({
    policy: new PPolicyEngine(["200"], ["channels"], false),
    respond: () => CHANNELS,
  });
  const result = await client.callTool({
    name: "discord_list_guild_channels",
    arguments: { guild_id: "200" },
  });
  expect(result.structuredContent).toEqual({ channels: CHANNELS });
  expect(request().method).toBe("GET");
});

it("denies access when guild is not allowed", async () => {
  const { client, makeRequest } = await harness({
    policy: new PPolicyEngine(["999"], ["channels"], false),
  });
  const result = await client.callTool({
    name: "discord_list_guild_channels",
    arguments: { guild_id: "200" },
  });
  expect(errorOf(result)).toMatchObject({
    category: "policy",
    message: "Guild is not allowed",
  });
  expect(makeRequest).not.toHaveBeenCalled();
});

it.each([
  { input: { guild_id: "not-a-snowflake" }, desc: "invalid snowflake" },
  { input: { guild_id: "200", extra: "unknown" }, desc: "unknown key" },
])("validates input: $desc", async ({ input }) => {
  const { client, makeRequest } = await harness({
    policy: new PPolicyEngine([], ["channels"], false),
  });
  const result = await client.callTool({
    name: "discord_list_guild_channels",
    arguments: input,
  });
  expect(errorOf(result)).toMatchObject({ category: "validation" });
  expect(makeRequest).not.toHaveBeenCalled();
});

it.each([
  [403, 50013, "permission", "Check the bot permissions"],
  [404, 10004, "not_found", "Check the IDs in the request"],
])("handles HTTP %i error", async (status, code, category, remediation) => {
  const { pipeline } = await harness({
    policy: new PPolicyEngine([], ["channels"], false),
    makeRequest: async () => json({ message: "Discord error", code }, { status }),
  });
  expect(await pipeline.call("discord_list_guild_channels", { guild_id: "200" })).toMatchObject({
    ok: false,
    error: {
      category,
      status,
      discord_code: code,
      remediation,
    },
  });
});
