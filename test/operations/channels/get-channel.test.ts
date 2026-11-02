import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { PPolicyEngine } from "../../../src/core/policy.js";
import { errorOf, harness, json } from "../../support/harness.js";

beforeEach(() => {
  vi.spyOn(process.stderr, "write").mockReturnValue(true);
});
afterEach(() => {
  vi.restoreAllMocks();
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

it.each([
  { input: { channel_id: "not-a-snowflake" }, desc: "invalid snowflake" },
  { input: { channel_id: "100", extra: "unknown" }, desc: "unknown key" },
])("validates input: $desc", async ({ input }) => {
  const { client, makeRequest } = await harness({
    policy: new PPolicyEngine([], ["channels"], false),
  });
  const result = await client.callTool({
    name: "discord_get_channel",
    arguments: input,
  });
  expect(errorOf(result)).toMatchObject({ category: "validation" });
  expect(makeRequest).not.toHaveBeenCalled();
});

it.each([
  [403, 50001, "permission", "Check the bot permissions; this tool needs ViewChannel"],
  [404, 10003, "not_found", "Check the IDs in the request"],
])("handles HTTP %i error", async (status, code, category, remediation) => {
  const { pipeline } = await harness({
    policy: new PPolicyEngine([], ["channels"], false),
    makeRequest: async () => json({ message: "Discord error", code }, { status }),
  });
  expect(await pipeline.call("discord_get_channel", { channel_id: "100" })).toMatchObject({
    ok: false,
    error: {
      category,
      status,
      discord_code: code,
      remediation,
    },
  });
});
