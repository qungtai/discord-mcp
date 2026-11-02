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

const CHANNEL = {
  id: "100",
  type: 0,
  guild_id: "200",
  name: "general",
  parent_id: null,
  position: 0,
  topic: "General chat",
};

it("gets a channel by ID", async () => {
  const { client, request } = await harness({
    policy: new PPolicyEngine([], ["channels"], false),
    respond: () => CHANNEL,
  });
  const result = await client.callTool({
    name: "discord_get_channel",
    arguments: { channel_id: "100" },
  });
  expect(request()).toMatchObject({
    method: "GET",
    url: "https://discord.com/api/v10/channels/100",
  });
  expect(result.structuredContent).toEqual({ channel: CHANNEL });
});

it("passes allowlist check when guild is allowed", async () => {
  const { client, request, makeRequest } = await harness({
    policy: new PPolicyEngine(["200"], ["channels"], false),
    respond: () => CHANNEL,
  });
  const result = await client.callTool({
    name: "discord_get_channel",
    arguments: { channel_id: "100" },
  });
  expect(result.structuredContent).toEqual({ channel: CHANNEL });
  expect(makeRequest).toHaveBeenCalledTimes(2);
  expect(request(0).method).toBe("GET");
  expect(request(1).method).toBe("GET");
});

it("denies access when channel is in an unallowed guild", async () => {
  const { client, makeRequest } = await harness({
    policy: new PPolicyEngine(["999"], ["channels"], false),
    respond: () => CHANNEL,
  });
  const result = await client.callTool({
    name: "discord_get_channel",
    arguments: { channel_id: "100" },
  });
  expect(errorOf(result)).toMatchObject({
    category: "policy",
    message: "Guild is not allowed",
  });
  expect(makeRequest).toHaveBeenCalledTimes(1);
});

it("validates channel_id is a snowflake", async () => {
  const { client, makeRequest } = await harness({
    policy: new PPolicyEngine([], ["channels"], false),
  });
  const result = await client.callTool({
    name: "discord_get_channel",
    arguments: { channel_id: "not-a-snowflake" },
  });
  expect(errorOf(result)).toMatchObject({ category: "validation" });
  expect(makeRequest).not.toHaveBeenCalled();
});

it("handles 403 missing permissions error", async () => {
  const { pipeline } = await harness({
    policy: new PPolicyEngine([], ["channels"], false),
    makeRequest: async () => json({ message: "Missing Access", code: 50001 }, { status: 403 }),
  });
  expect(await pipeline.call("discord_get_channel", { channel_id: "100" })).toMatchObject({
    ok: false,
    error: {
      category: "permission",
      status: 403,
      discord_code: 50001,
      remediation: "Check the bot permissions; this tool needs ViewChannel",
    },
  });
});

it("handles 404 not found error", async () => {
  const { pipeline } = await harness({
    policy: new PPolicyEngine([], ["channels"], false),
    makeRequest: async () => json({ message: "Unknown Channel", code: 10003 }, { status: 404 }),
  });
  expect(await pipeline.call("discord_get_channel", { channel_id: "100" })).toMatchObject({
    ok: false,
    error: {
      category: "not_found",
      status: 404,
      discord_code: 10003,
      remediation: "Check the IDs in the request",
    },
  });
});
