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

it("adds target user with literal method and route", async () => {
  const { client, request } = await harness({
    policy: new PPolicyEngine([], ["invites"], false),
    makeRequest: async () => empty204(),
  });
  const result = await client.callTool({
    name: "discord_add_invite_target_user",
    arguments: {
      code: "userinvite",
      user_id: "123456789012345678",
    },
  });
  expect(result.structuredContent).toEqual({
    added: true,
    code: "userinvite",
    user_id: "123456789012345678",
  });
  const req = request();
  expect([req.method, req.url]).toEqual([
    "PUT",
    "https://discord.com/api/v10/invites/userinvite/target-users/123456789012345678",
  ]);
});

it("rejects an invalid code with dot segments", async () => {
  const { client, makeRequest } = await harness({
    policy: new PPolicyEngine([], ["invites"], false),
  });
  const result = await client.callTool({
    name: "discord_add_invite_target_user",
    arguments: {
      code: "%2e",
      user_id: "123456789012345678",
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
    name: "discord_add_invite_target_user",
    arguments: {
      code: "userinvite",
      user_id: "123456789012345678",
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
    name: "discord_add_invite_target_user",
    arguments: {
      code: "userinvite",
      user_id: "123456789012345678",
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
    makeRequest: async (url) => {
      const u = String(url);
      if (u.includes("/target-users/123456789012345678")) return empty204();
      return json({ code: "userinvite", guild_id: "500" });
    },
  });
  const successResult = await allowed.client.callTool({
    name: "discord_add_invite_target_user",
    arguments: {
      code: "userinvite",
      user_id: "123456789012345678",
    },
  });
  expect(successResult.structuredContent).toEqual({
    added: true,
    code: "userinvite",
    user_id: "123456789012345678",
  });
  expect(allowed.makeRequest).toHaveBeenCalledTimes(2);

  const denied = await harness({
    policy: new PPolicyEngine(["500"], ["invites"], false),
    respond: () => ({ code: "userinvite", guild_id: "999" }),
  });
  const deniedResult = await denied.client.callTool({
    name: "discord_add_invite_target_user",
    arguments: {
      code: "userinvite",
      user_id: "123456789012345678",
    },
  });
  expect(errorOf(deniedResult)).toMatchObject({
    category: "policy",
    message: "Guild is not allowed",
  });
  expect(denied.makeRequest).toHaveBeenCalledTimes(1);
});
