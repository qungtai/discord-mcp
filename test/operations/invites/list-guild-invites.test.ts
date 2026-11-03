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

const GUILD_INVITE = {
  code: "guildinv1",
  guild_id: "500",
  channel: { id: "100" },
  uses: 2,
  max_uses: 10,
};

it("lists guild invites with literal method and route", async () => {
  const { client, request } = await harness({
    policy: new PPolicyEngine([], ["invites"], false),
    respond: () => [GUILD_INVITE],
  });
  const result = await client.callTool({
    name: "discord_list_guild_invites",
    arguments: {
      guild_id: "500",
    },
  });
  expect(result.structuredContent).toEqual({
    invites: [GUILD_INVITE],
  });
  const req = request();
  expect([req.method, req.url]).toEqual(["GET", "https://discord.com/api/v10/guilds/500/invites"]);
});

it("rejects invalid guild_id", async () => {
  const { client, makeRequest } = await harness({
    policy: new PPolicyEngine([], ["invites"], false),
  });
  const result = await client.callTool({
    name: "discord_list_guild_invites",
    arguments: { guild_id: "invalid-id" },
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
    name: "discord_list_guild_invites",
    arguments: { guild_id: "500" },
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
    makeRequest: async () => json({ message: "Unknown Guild", code: 10004 }, { status: 404 }),
  });
  const result = await client.callTool({
    name: "discord_list_guild_invites",
    arguments: { guild_id: "500" },
  });
  expect(errorOf(result)).toMatchObject({
    category: "not_found",
    status: 404,
  });
});

it("succeeds when guild is in allowlist and denies when it is not", async () => {
  const allowed = await harness({
    policy: new PPolicyEngine(["500"], ["invites"], false),
    respond: () => [GUILD_INVITE],
  });
  const successResult = await allowed.client.callTool({
    name: "discord_list_guild_invites",
    arguments: { guild_id: "500" },
  });
  expect(successResult.structuredContent).toEqual({
    invites: [GUILD_INVITE],
  });
  expect(allowed.makeRequest).toHaveBeenCalledTimes(1);
  expect(allowed.request(0)).toMatchObject({
    method: "GET",
    url: "https://discord.com/api/v10/guilds/500/invites",
  });

  const denied = await harness({
    policy: new PPolicyEngine(["500"], ["invites"], false),
  });
  const deniedResult = await denied.client.callTool({
    name: "discord_list_guild_invites",
    arguments: { guild_id: "999" },
  });
  expect(errorOf(deniedResult)).toMatchObject({
    category: "policy",
    message: "Guild is not allowed",
  });
  expect(denied.makeRequest).not.toHaveBeenCalled();
});
