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

const CSV_CONTENT = "123456789012345678\n987654321098765432\n";

it("gets invite target users returning csv text in the csv field", async () => {
  const { client, request } = await harness({
    policy: new PPolicyEngine([], ["invites"], false),
    makeRequest: async () =>
      new Response(CSV_CONTENT, {
        status: 200,
        headers: { "content-type": "text/csv" },
      }) as unknown as ResponseLike,
  });
  const result = await client.callTool({
    name: "discord_list_invite_target_users",
    arguments: {
      code: "vipinvite",
    },
  });
  expect(result.structuredContent).toEqual({
    csv: CSV_CONTENT,
  });
  const req = request();
  expect([req.method, req.url]).toEqual([
    "GET",
    "https://discord.com/api/v10/invites/vipinvite/target-users",
  ]);
});

it("rejects an invalid code with dot segments", async () => {
  const { client, makeRequest } = await harness({
    policy: new PPolicyEngine([], ["invites"], false),
  });
  const result = await client.callTool({
    name: "discord_list_invite_target_users",
    arguments: { code: "." },
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
    name: "discord_list_invite_target_users",
    arguments: { code: "vipinvite" },
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
    name: "discord_list_invite_target_users",
    arguments: { code: "vipinvite" },
  });
  expect(errorOf(result)).toMatchObject({
    category: "not_found",
    status: 404,
  });
});

it("succeeds when invite resolves to an allowed guild and denies when not allowed", async () => {
  const allowed = await harness({
    policy: new PPolicyEngine(["500"], ["invites"], false),
    makeRequest: async (url) => {
      const u = String(url);
      if (u.endsWith("/target-users")) {
        return new Response(CSV_CONTENT, { status: 200 }) as unknown as ResponseLike;
      }
      return json({ code: "vipinvite", guild_id: "500" });
    },
  });
  const successResult = await allowed.client.callTool({
    name: "discord_list_invite_target_users",
    arguments: { code: "vipinvite" },
  });
  expect(successResult.structuredContent).toEqual({
    csv: CSV_CONTENT,
  });
  expect(allowed.makeRequest).toHaveBeenCalledTimes(2);

  const denied = await harness({
    policy: new PPolicyEngine(["500"], ["invites"], false),
    respond: () => ({ code: "vipinvite", guild_id: "999" }),
  });
  const deniedResult = await denied.client.callTool({
    name: "discord_list_invite_target_users",
    arguments: { code: "vipinvite" },
  });
  expect(errorOf(deniedResult)).toMatchObject({
    category: "policy",
    message: "Guild is not allowed",
  });
  expect(denied.makeRequest).toHaveBeenCalledTimes(1);
});
