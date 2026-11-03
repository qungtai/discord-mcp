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

const JOB_STATUS = {
  status: 2,
  total_users: 100,
  processed_users: 100,
  created_at: "2026-11-03T00:00:00.000Z",
  completed_at: "2026-11-03T00:01:00.000Z",
  error_message: null,
};

it("gets invite target users job status with literal method and route", async () => {
  const { client, request } = await harness({
    policy: new PPolicyEngine([], ["invites"], false),
    respond: () => JOB_STATUS,
  });
  const result = await client.callTool({
    name: "discord_get_invite_target_users_job_status",
    arguments: {
      code: "jobinvite",
    },
  });
  expect(result.structuredContent).toEqual({
    job_status: JOB_STATUS,
  });
  const req = request();
  expect([req.method, req.url]).toEqual([
    "GET",
    "https://discord.com/api/v10/invites/jobinvite/target-users/job-status",
  ]);
});

it("rejects an invalid code with dot segments", async () => {
  const { client, makeRequest } = await harness({
    policy: new PPolicyEngine([], ["invites"], false),
  });
  const result = await client.callTool({
    name: "discord_get_invite_target_users_job_status",
    arguments: { code: ".." },
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
    name: "discord_get_invite_target_users_job_status",
    arguments: { code: "jobinvite" },
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
    name: "discord_get_invite_target_users_job_status",
    arguments: { code: "jobinvite" },
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
      if (u.endsWith("/job-status")) return json(JOB_STATUS);
      return json({ code: "jobinvite", guild_id: "500" });
    },
  });
  const successResult = await allowed.client.callTool({
    name: "discord_get_invite_target_users_job_status",
    arguments: { code: "jobinvite" },
  });
  expect(successResult.structuredContent).toEqual({
    job_status: JOB_STATUS,
  });
  expect(allowed.makeRequest).toHaveBeenCalledTimes(2);

  const denied = await harness({
    policy: new PPolicyEngine(["500"], ["invites"], false),
    respond: () => ({ code: "jobinvite", guild_id: "999" }),
  });
  const deniedResult = await denied.client.callTool({
    name: "discord_get_invite_target_users_job_status",
    arguments: { code: "jobinvite" },
  });
  expect(errorOf(deniedResult)).toMatchObject({
    category: "policy",
    message: "Guild is not allowed",
  });
  expect(denied.makeRequest).toHaveBeenCalledTimes(1);
});
