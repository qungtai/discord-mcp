import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { PPolicyEngine } from "../../../src/core/policy.js";
import { errorOf, harness, json, MESSAGE } from "../../support/harness.js";

beforeEach(() => {
  vi.spyOn(process.stderr, "write").mockReturnValue(true);
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it("lists pinned messages in a channel", async () => {
  const { client, request } = await harness({ respond: () => [MESSAGE] });
  const result = await client.callTool({
    name: "discord_list_pins",
    arguments: { channel_id: "1" },
  });
  const { url, method } = request();
  expect([method, url]).toEqual(["GET", "https://discord.com/api/v10/channels/1/pins"]);
  expect(result.structuredContent).toEqual({ messages: [MESSAGE] });
});

it("allows access under an allowed guild", async () => {
  const { client } = await harness({
    policy: new PPolicyEngine(["100"], ["core", "messages"], false),
    makeRequest: async (url) => {
      if (String(url).endsWith("/channels/1")) return json({ id: "1", guild_id: "100" });
      return json([MESSAGE]);
    },
  });
  const result = await client.callTool({
    name: "discord_list_pins",
    arguments: { channel_id: "1" },
  });
  expect(result.structuredContent).toEqual({ messages: [MESSAGE] });
});

it("blocks access when channel belongs to a disallowed guild", async () => {
  const { client, makeRequest } = await harness({
    policy: new PPolicyEngine(["100"], ["core", "messages"], false),
    respond: () => ({ id: "1", guild_id: "200" }),
  });
  const result = await client.callTool({
    name: "discord_list_pins",
    arguments: { channel_id: "1" },
  });
  expect(errorOf(result)).toMatchObject({ category: "policy", message: "Guild is not allowed" });
  expect(makeRequest).toHaveBeenCalledTimes(1);
});

it("fails input validation on invalid snowflake", async () => {
  const { client, makeRequest } = await harness();
  const result = await client.callTool({
    name: "discord_list_pins",
    arguments: { channel_id: "invalid" },
  });
  expect(errorOf(result)).toMatchObject({ category: "validation" });
  expect(makeRequest).not.toHaveBeenCalled();
});
