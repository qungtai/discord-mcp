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

const INVITE = {
  code: "testcode",
  guild_id: "500",
  channel: { id: "100" },
  approximate_member_count: 42,
  approximate_presence_count: 10,
};

it("resolves an invite by code with literal method, route and query", async () => {
  const { client, request } = await harness({
    policy: new PPolicyEngine([], ["invites"], false),
    respond: () => INVITE,
  });
  const result = await client.callTool({
    name: "discord_get_invite",
    arguments: {
      code: "testcode",
      with_counts: true,
      guild_scheduled_event_id: "777",
      target_channel_id: "100",
      target_message_id: "200",
    },
  });
  expect(result.structuredContent).toEqual({
    invite: INVITE,
  });
  const req = request();
  expect([req.method, req.url]).toEqual([
    "GET",
    "https://discord.com/api/v10/invites/testcode?with_counts=true&guild_scheduled_event_id=777&target_channel_id=100&target_message_id=200",
  ]);
});

it("rejects an invalid code with dot segments or bad characters", async () => {
  const { client, makeRequest } = await harness({
    policy: new PPolicyEngine([], ["invites"], false),
  });
  const result = await client.callTool({
    name: "discord_get_invite",
    arguments: { code: "../bad" },
  });
  expect(errorOf(result)).toMatchObject({
    category: "validation",
  });
  expect(makeRequest).not.toHaveBeenCalled();
});

it("maps 404 to not_found", async () => {
  const { client } = await harness({
    policy: new PPolicyEngine([], ["invites"], false),
    makeRequest: async () => json({ message: "Unknown Invite", code: 10006 }, { status: 404 }),
  });
  const result = await client.callTool({
    name: "discord_get_invite",
    arguments: { code: "testcode" },
  });
  expect(errorOf(result)).toMatchObject({
    category: "not_found",
    status: 404,
  });
});

it("succeeds when invite resolves to an allowed guild and denies when not allowed", async () => {
  const allowed = await harness({
    policy: new PPolicyEngine(["500"], ["invites"], false),
    respond: () => INVITE,
  });
  const successResult = await allowed.client.callTool({
    name: "discord_get_invite",
    arguments: { code: "testcode" },
  });
  expect(successResult.structuredContent).toEqual({
    invite: INVITE,
  });
  expect(allowed.makeRequest).toHaveBeenCalledTimes(2);
  expect(allowed.request(0)).toMatchObject({
    method: "GET",
    url: "https://discord.com/api/v10/invites/testcode",
  });
  expect(allowed.request(1)).toMatchObject({
    method: "GET",
    url: "https://discord.com/api/v10/invites/testcode",
  });

  const denied = await harness({
    policy: new PPolicyEngine(["500"], ["invites"], false),
    respond: () => ({ ...INVITE, guild_id: "999" }),
  });
  const deniedResult = await denied.client.callTool({
    name: "discord_get_invite",
    arguments: { code: "testcode" },
  });
  expect(errorOf(deniedResult)).toMatchObject({
    category: "policy",
    message: "Guild is not allowed",
  });
  expect(denied.makeRequest).toHaveBeenCalledTimes(1);
  expect(denied.request(0)).toMatchObject({
    method: "GET",
    url: "https://discord.com/api/v10/invites/testcode",
  });
});

it("denies when target_channel_id belongs to another guild", async () => {
  const clientHarness = await harness({
    policy: new PPolicyEngine(["500"], ["invites"], false),
    makeRequest: async (url) => {
      const u = String(url);
      if (u.includes("/channels/999")) {
        return json({ id: "999", guild_id: "777" });
      }
      return json(INVITE);
    },
  });
  const result = await clientHarness.client.callTool({
    name: "discord_get_invite",
    arguments: {
      code: "testcode",
      target_channel_id: "999",
    },
  });
  expect(errorOf(result)).toMatchObject({
    category: "policy",
    message: "Guild is not allowed",
  });
});
