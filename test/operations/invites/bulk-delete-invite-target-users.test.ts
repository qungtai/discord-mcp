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

const empty204 = () => new Response(null, { status: 204 }) as unknown as ResponseLike;

it("bulk removes target users with literal method, route and body", async () => {
  const { client, request } = await harness({
    policy: new PPolicyEngine([], ["invites"], false),
    makeRequest: async () => empty204(),
  });
  const result = await client.callTool({
    name: "discord_bulk_delete_invite_target_users",
    arguments: {
      code: "bulkcode",
      user_ids: ["111", "222"],
    },
  });
  expect(result.structuredContent).toEqual({
    deleted: true,
    code: "bulkcode",
    count: 2,
  });
  const req = request();
  expect([req.method, req.url]).toEqual([
    "POST",
    "https://discord.com/api/v10/invites/bulkcode/target-users/bulk-delete",
  ]);
  expect(JSON.parse(String(req.body))).toEqual({
    user_ids: ["111", "222"],
  });
});

it("rejects an empty user_ids array", async () => {
  const { client, makeRequest } = await harness({
    policy: new PPolicyEngine([], ["invites"], false),
  });
  const result = await client.callTool({
    name: "discord_bulk_delete_invite_target_users",
    arguments: {
      code: "bulkcode",
      user_ids: [],
    },
  });
  expect(errorOf(result)).toMatchObject({
    category: "validation",
  });
  expect(makeRequest).not.toHaveBeenCalled();
});

it("rejects user_ids array exceeding 1000 items", async () => {
  const { client, makeRequest } = await harness({
    policy: new PPolicyEngine([], ["invites"], false),
  });
  const result = await client.callTool({
    name: "discord_bulk_delete_invite_target_users",
    arguments: {
      code: "bulkcode",
      user_ids: Array.from({ length: 1001 }, (_, i) => String(i + 1)),
    },
  });
  expect(errorOf(result)).toMatchObject({
    category: "validation",
  });
  expect(makeRequest).not.toHaveBeenCalled();
});

it("rejects non-snowflake entry in user_ids", async () => {
  const { client, makeRequest } = await harness({
    policy: new PPolicyEngine([], ["invites"], false),
  });
  const result = await client.callTool({
    name: "discord_bulk_delete_invite_target_users",
    arguments: {
      code: "bulkcode",
      user_ids: ["invalid-id"],
    },
  });
  expect(errorOf(result)).toMatchObject({
    category: "validation",
  });
  expect(makeRequest).not.toHaveBeenCalled();
});

it("maps 403 to permission with ManageGuild requirement", async () => {
  const { client } = await harness({
    policy: new PPolicyEngine([], ["invites"], false),
    makeRequest: async () => json({ message: "Missing Permissions", code: 50013 }, { status: 403 }),
  });
  const result = await client.callTool({
    name: "discord_bulk_delete_invite_target_users",
    arguments: {
      code: "bulkcode",
      user_ids: ["111"],
    },
  });
  expect(errorOf(result)).toMatchObject({
    category: "permission",
    status: 403,
    discord_code: 50013,
    remediation: "Check the bot permissions; this tool needs ManageGuild",
  });
});

it("maps 404 to not_found", async () => {
  const { client } = await harness({
    policy: new PPolicyEngine([], ["invites"], false),
    makeRequest: async () => json({ message: "Unknown Invite", code: 10006 }, { status: 404 }),
  });
  const result = await client.callTool({
    name: "discord_bulk_delete_invite_target_users",
    arguments: {
      code: "bulkcode",
      user_ids: ["111"],
    },
  });
  expect(errorOf(result)).toMatchObject({
    category: "not_found",
    status: 404,
  });
});

it("succeeds when invite resolves to an allowed guild and denies when not allowed", async () => {
  const allowed = await harness({
    policy: new PPolicyEngine(["500"], ["invites"], false),
    makeRequest: async (_url, init) => {
      if (init?.method === "POST") return empty204();
      return json({ code: "bulkcode", guild_id: "500" });
    },
  });
  const successResult = await allowed.client.callTool({
    name: "discord_bulk_delete_invite_target_users",
    arguments: {
      code: "bulkcode",
      user_ids: ["111"],
    },
  });
  expect(successResult.structuredContent).toEqual({
    deleted: true,
    code: "bulkcode",
    count: 1,
  });
  expect(allowed.makeRequest).toHaveBeenCalledTimes(2);
  expect(allowed.request(0)).toMatchObject({
    method: "GET",
    url: "https://discord.com/api/v10/invites/bulkcode",
  });
  expect(allowed.request(1)).toMatchObject({
    method: "POST",
    url: "https://discord.com/api/v10/invites/bulkcode/target-users/bulk-delete",
  });

  const denied = await harness({
    policy: new PPolicyEngine(["500"], ["invites"], false),
    respond: () => ({ code: "bulkcode", guild_id: "999" }),
  });
  const deniedResult = await denied.client.callTool({
    name: "discord_bulk_delete_invite_target_users",
    arguments: {
      code: "bulkcode",
      user_ids: ["111"],
    },
  });
  expect(errorOf(deniedResult)).toMatchObject({
    category: "policy",
    message: "Guild is not allowed",
  });
  expect(denied.makeRequest).toHaveBeenCalledTimes(1);
  expect(denied.request(0)).toMatchObject({
    method: "GET",
    url: "https://discord.com/api/v10/invites/bulkcode",
  });
});
