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

it("validates guild_id is a snowflake", async () => {
  const { client, makeRequest } = await harness({
    policy: new PPolicyEngine([], ["channels"], false),
  });
  const result = await client.callTool({
    name: "discord_list_guild_channels",
    arguments: { guild_id: "not-a-snowflake" },
  });
  expect(errorOf(result)).toMatchObject({ category: "validation" });
  expect(makeRequest).not.toHaveBeenCalled();
});

it("handles 403 missing permissions error", async () => {
  const { pipeline } = await harness({
    policy: new PPolicyEngine([], ["channels"], false),
    makeRequest: async () => json({ message: "Missing Permissions", code: 50013 }, { status: 403 }),
  });
  expect(await pipeline.call("discord_list_guild_channels", { guild_id: "200" })).toMatchObject({
    ok: false,
    error: {
      category: "permission",
      status: 403,
      discord_code: 50013,
      remediation: "Check the bot permissions; this tool needs ManageChannels",
    },
  });
});

it("handles 404 not found error", async () => {
  const { pipeline } = await harness({
    policy: new PPolicyEngine([], ["channels"], false),
    makeRequest: async () => json({ message: "Unknown Guild", code: 10004 }, { status: 404 }),
  });
  expect(await pipeline.call("discord_list_guild_channels", { guild_id: "200" })).toMatchObject({
    ok: false,
    error: {
      category: "not_found",
      status: 404,
      discord_code: 10004,
      remediation: "Check the IDs in the request",
    },
  });
});
