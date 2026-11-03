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

const DELETED_INVITE = {
  code: "revokeme",
  guild_id: "500",
  channel: { id: "100" },
};

it("deletes an invite by code with literal method, route and audit reason", async () => {
  const { client, request } = await harness({
    policy: new PPolicyEngine([], ["invites"], false),
    respond: () => DELETED_INVITE,
  });
  const result = await client.callTool({
    name: "discord_delete_invite",
    arguments: {
      code: "revokeme",
      reason: "cleaning up expired invites",
    },
  });
  expect(result.structuredContent).toEqual({
    invite: DELETED_INVITE,
  });
  const req = request();
  expect([req.method, req.url]).toEqual(["DELETE", "https://discord.com/api/v10/invites/revokeme"]);
  expect(new Headers(req.headers as HeadersInit).get("x-audit-log-reason")).toBe(
    "cleaning%20up%20expired%20invites",
  );
});

it("rejects an invalid code with dot segments", async () => {
  const { client, makeRequest } = await harness({
    policy: new PPolicyEngine([], ["invites"], false),
  });
  const result = await client.callTool({
    name: "discord_delete_invite",
    arguments: { code: ".." },
  });
  expect(errorOf(result)).toMatchObject({
    category: "validation",
  });
  expect(makeRequest).not.toHaveBeenCalled();
});

it("maps 403 to permission with ManageChannels, ManageGuild requirement", async () => {
  const { client } = await harness({
    policy: new PPolicyEngine([], ["invites"], false),
    makeRequest: async () => json({ message: "Missing Permissions", code: 50013 }, { status: 403 }),
  });
  const result = await client.callTool({
    name: "discord_delete_invite",
    arguments: { code: "revokeme" },
  });
  expect(errorOf(result)).toMatchObject({
    category: "permission",
    status: 403,
    discord_code: 50013,
    remediation: "Check the bot permissions; this tool needs ManageChannels, ManageGuild",
  });
});

it("maps 404 to not_found", async () => {
  const { client } = await harness({
    policy: new PPolicyEngine([], ["invites"], false),
    makeRequest: async () => json({ message: "Unknown Invite", code: 10006 }, { status: 404 }),
  });
  const result = await client.callTool({
    name: "discord_delete_invite",
    arguments: { code: "revokeme" },
  });
  expect(errorOf(result)).toMatchObject({
    category: "not_found",
    status: 404,
  });
});

it("succeeds when invite resolves to an allowed guild and denies when not allowed", async () => {
  const allowed = await harness({
    policy: new PPolicyEngine(["500"], ["invites"], false),
    makeRequest: async () => json(DELETED_INVITE),
  });
  const successResult = await allowed.client.callTool({
    name: "discord_delete_invite",
    arguments: { code: "revokeme" },
  });
  expect(successResult.structuredContent).toEqual({
    invite: DELETED_INVITE,
  });
  expect(allowed.makeRequest).toHaveBeenCalled();

  const denied = await harness({
    policy: new PPolicyEngine(["500"], ["invites"], false),
    respond: () => ({ ...DELETED_INVITE, guild_id: "999" }),
  });
  const deniedResult = await denied.client.callTool({
    name: "discord_delete_invite",
    arguments: { code: "revokeme" },
  });
  expect(errorOf(deniedResult)).toMatchObject({
    category: "policy",
    message: "Guild is not allowed",
  });
});
