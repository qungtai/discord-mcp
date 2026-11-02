import type { ResponseLike } from "@discordjs/rest";
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

const args = { channel_id: "1", message_id: "2", reason: "important notice" };
const empty204 = () => new Response(null, { status: 204 }) as unknown as ResponseLike;

it("pins a message in a channel with an audit reason", async () => {
  const { client, request } = await harness({
    makeRequest: async () => empty204(),
  });
  const result = await client.callTool({
    name: "discord_create_pin",
    arguments: args,
  });
  const { url, method, headers } = request();
  expect([method, url]).toEqual(["PUT", "https://discord.com/api/v10/channels/1/pins/2"]);
  expect(new Headers(headers as HeadersInit).get("x-audit-log-reason")).toBe("important%20notice");
  expect(result.structuredContent).toEqual({
    pinned: true,
    channel_id: "1",
    message_id: "2",
  });
});

it("allows access under an allowed guild", async () => {
  const { client } = await harness({
    policy: new PPolicyEngine(["100"], ["core", "messages"], false),
    makeRequest: async (url) => {
      if (String(url).endsWith("/channels/1")) return json({ id: "1", guild_id: "100" });
      return empty204();
    },
  });
  const result = await client.callTool({
    name: "discord_create_pin",
    arguments: { channel_id: "1", message_id: "2" },
  });
  expect(result.structuredContent).toEqual({
    pinned: true,
    channel_id: "1",
    message_id: "2",
  });
});

it("blocks access when channel belongs to a disallowed guild", async () => {
  const { client, makeRequest } = await harness({
    policy: new PPolicyEngine(["100"], ["core", "messages"], false),
    respond: () => ({ id: "1", guild_id: "200" }),
  });
  const result = await client.callTool({
    name: "discord_create_pin",
    arguments: { channel_id: "1", message_id: "2" },
  });
  expect(errorOf(result)).toMatchObject({ category: "policy", message: "Guild is not allowed" });
  expect(makeRequest).toHaveBeenCalledTimes(1);
});

it("maps a 403 to permission error", async () => {
  const { pipeline } = await harness({
    makeRequest: async () => json({ message: "Missing Permissions", code: 50013 }, { status: 403 }),
  });
  expect(
    await pipeline.call("discord_create_pin", { channel_id: "1", message_id: "2" }),
  ).toMatchObject({
    ok: false,
    error: {
      category: "permission",
      retryable: false,
      status: 403,
      discord_code: 50013,
      remediation: "Check the bot permissions; this tool needs ViewChannel, ManageMessages",
    },
  });
});
