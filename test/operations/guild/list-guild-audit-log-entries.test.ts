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

const AUDIT_ENTRY_1 = { id: "100" };
const AUDIT_ENTRY_2 = { id: "90" };
const AUDIT_LOG = {
  audit_log_entries: [AUDIT_ENTRY_1, AUDIT_ENTRY_2],
  users: [{ id: "1" }],
};

it("lists audit log entries with query params and paging cursors", async () => {
  const { client, request } = await harness({
    policy: new PPolicyEngine([], ["guild"], false),
    respond: () => AUDIT_LOG,
  });
  const result = await client.callTool({
    name: "discord_list_guild_audit_log_entries",
    arguments: {
      guild_id: "123",
      limit: 10,
      user_id: "1",
      action_type: 1,
    },
  });
  const req = request();
  expect(req.method).toBe("GET");
  expect(req.url).toBe(
    "https://discord.com/api/v10/guilds/123/audit-logs?user_id=1&action_type=1&limit=10",
  );
  expect(result.structuredContent).toEqual({
    audit_log: AUDIT_LOG,
    next_before: "90",
    next_after: "100",
  });
});

it("validates query limit min/max", async () => {
  const { client, makeRequest } = await harness({
    policy: new PPolicyEngine([], ["guild"], false),
  });
  const result = await client.callTool({
    name: "discord_list_guild_audit_log_entries",
    arguments: { guild_id: "123", limit: 0 },
  });
  expect(errorOf(result)).toMatchObject({ category: "validation" });
  expect(makeRequest).not.toHaveBeenCalled();
});

it("maps a 403 error to permission with ViewAuditLog remediation", async () => {
  const { client } = await harness({
    policy: new PPolicyEngine([], ["guild"], false),
    makeRequest: async () => json({ message: "Missing Permissions", code: 50013 }, { status: 403 }),
  });
  const result = await client.callTool({
    name: "discord_list_guild_audit_log_entries",
    arguments: { guild_id: "123" },
  });
  expect(errorOf(result)).toMatchObject({
    category: "permission",
    status: 403,
    remediation: "Check the bot permissions; this tool needs ViewAuditLog",
  });
});

it("maps a 404 error to not_found", async () => {
  const { client } = await harness({
    policy: new PPolicyEngine([], ["guild"], false),
    makeRequest: async () => json({ message: "Unknown Guild", code: 10004 }, { status: 404 }),
  });
  const result = await client.callTool({
    name: "discord_list_guild_audit_log_entries",
    arguments: { guild_id: "123" },
  });
  expect(errorOf(result)).toMatchObject({ category: "not_found", status: 404 });
});

it("allows access when guild is in allowlist", async () => {
  const { client, request } = await harness({
    policy: new PPolicyEngine(["123"], ["guild"], false),
    respond: () => AUDIT_LOG,
  });
  const result = await client.callTool({
    name: "discord_list_guild_audit_log_entries",
    arguments: { guild_id: "123" },
  });
  expect(result.structuredContent).toEqual({
    audit_log: AUDIT_LOG,
    next_before: "90",
    next_after: "100",
  });
  expect(request().method).toBe("GET");
});

it("denies access when guild is not in allowlist", async () => {
  const { client, makeRequest } = await harness({
    policy: new PPolicyEngine(["999"], ["guild"], false),
  });
  const result = await client.callTool({
    name: "discord_list_guild_audit_log_entries",
    arguments: { guild_id: "123" },
  });
  expect(errorOf(result)).toMatchObject({
    category: "policy",
    message: "Guild is not allowed",
  });
  expect(makeRequest).not.toHaveBeenCalled();
});
