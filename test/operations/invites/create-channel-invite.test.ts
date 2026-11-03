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

const CREATED_INVITE = {
  code: "newinvite",
  guild_id: "500",
  channel: { id: "100" },
  max_age: 86400,
  max_uses: 5,
  temporary: true,
};

it("creates channel invite with literal method, route and body", async () => {
  const { client, request } = await harness({
    policy: new PPolicyEngine([], ["invites"], false),
    respond: () => CREATED_INVITE,
  });
  const result = await client.callTool({
    name: "discord_create_channel_invite",
    arguments: {
      channel_id: "100",
      max_age: 86400,
      max_uses: 5,
      temporary: true,
      unique: true,
      target_type: 1,
      target_user_id: "300",
      role_ids: ["400"],
      target_user_ids: ["300", "301"],
      reason: "special event invite",
    },
  });
  expect(result.structuredContent).toEqual({
    invite: CREATED_INVITE,
  });
  const req = request();
  expect([req.method, req.url]).toEqual([
    "POST",
    "https://discord.com/api/v10/channels/100/invites",
  ]);
  expect(JSON.parse(String(req.body))).toEqual({
    max_age: 86400,
    max_uses: 5,
    temporary: true,
    unique: true,
    target_type: 1,
    target_user_id: "300",
    role_ids: ["400"],
    target_user_ids: ["300", "301"],
  });
  expect(req.headers).toMatchObject({
    "X-Audit-Log-Reason": "special%20event%20invite",
  });
});

it("rejects max_uses over 100", async () => {
  const { client, makeRequest } = await harness({
    policy: new PPolicyEngine([], ["invites"], false),
  });
  const result = await client.callTool({
    name: "discord_create_channel_invite",
    arguments: {
      channel_id: "100",
      max_uses: 101,
    },
  });
  expect(errorOf(result)).toMatchObject({ category: "validation" });
  expect(makeRequest).not.toHaveBeenCalled();
});

it("rejects max_age over 5184000", async () => {
  const { client, makeRequest } = await harness({
    policy: new PPolicyEngine([], ["invites"], false),
  });
  const result = await client.callTool({
    name: "discord_create_channel_invite",
    arguments: {
      channel_id: "100",
      max_age: 5184001,
    },
  });
  expect(errorOf(result)).toMatchObject({ category: "validation" });
  expect(makeRequest).not.toHaveBeenCalled();
});

it("rejects target_type without required target ID", async () => {
  const { client, makeRequest } = await harness({
    policy: new PPolicyEngine([], ["invites"], false),
  });
  const result1 = await client.callTool({
    name: "discord_create_channel_invite",
    arguments: {
      channel_id: "100",
      target_type: 1,
    },
  });
  expect(errorOf(result1)).toMatchObject({ category: "validation" });

  const result2 = await client.callTool({
    name: "discord_create_channel_invite",
    arguments: {
      channel_id: "100",
      target_type: 2,
    },
  });
  expect(errorOf(result2)).toMatchObject({ category: "validation" });
  expect(makeRequest).not.toHaveBeenCalled();
});

it("maps 403 to permission with CreateInstantInvite requirement", async () => {
  const { client } = await harness({
    policy: new PPolicyEngine([], ["invites"], false),
    makeRequest: async () => json({ message: "Missing Permissions", code: 50013 }, { status: 403 }),
  });
  const result = await client.callTool({
    name: "discord_create_channel_invite",
    arguments: { channel_id: "100" },
  });
  expect(errorOf(result)).toMatchObject({
    category: "permission",
    status: 403,
    discord_code: 50013,
    remediation:
      "Check the bot permissions; this tool needs CreateInstantInvite, ManageRoles, ManageGuild",
  });
});

it("maps 404 to not_found", async () => {
  const { client } = await harness({
    policy: new PPolicyEngine([], ["invites"], false),
    makeRequest: async () => json({ message: "Unknown Channel", code: 10003 }, { status: 404 }),
  });
  const result = await client.callTool({
    name: "discord_create_channel_invite",
    arguments: { channel_id: "100" },
  });
  expect(errorOf(result)).toMatchObject({
    category: "not_found",
    status: 404,
  });
});

it("succeeds when channel is in allowlist and denies when it is not", async () => {
  const allowed = await harness({
    policy: new PPolicyEngine(["500"], ["invites"], false),
    makeRequest: async (url) => {
      const u = String(url);
      if (u.endsWith("/channels/100")) {
        return json({ id: "100", guild_id: "500" });
      }
      return json(CREATED_INVITE);
    },
  });
  const successResult = await allowed.client.callTool({
    name: "discord_create_channel_invite",
    arguments: { channel_id: "100" },
  });
  expect(successResult.structuredContent).toEqual({
    invite: CREATED_INVITE,
  });
  expect(allowed.makeRequest).toHaveBeenCalledTimes(2);
  expect(allowed.request(0)).toMatchObject({
    method: "GET",
    url: "https://discord.com/api/v10/channels/100",
  });
  expect(allowed.request(1)).toMatchObject({
    method: "POST",
    url: "https://discord.com/api/v10/channels/100/invites",
  });

  const denied = await harness({
    policy: new PPolicyEngine(["500"], ["invites"], false),
    respond: () => ({ id: "100", guild_id: "999" }),
  });
  const deniedResult = await denied.client.callTool({
    name: "discord_create_channel_invite",
    arguments: { channel_id: "100" },
  });
  expect(errorOf(deniedResult)).toMatchObject({
    category: "policy",
    message: "Guild is not allowed",
  });
  expect(denied.makeRequest).toHaveBeenCalledTimes(1);
  expect(denied.request(0)).toMatchObject({
    method: "GET",
    url: "https://discord.com/api/v10/channels/100",
  });
});
