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

const AUDIT_ENTRY_1 = {
  id: "100",
  action_type: 1,
  user_id: "50",
  target_id: "60",
  changes: [{ key: "name", old_value: "old", new_value: "new" }],
};
const AUDIT_ENTRY_2 = {
  id: "90",
  action_type: 20,
  user_id: "51",
  target_id: "61",
};
const AUDIT_LOG = {
  audit_log_entries: [AUDIT_ENTRY_1, AUDIT_ENTRY_2],
  users: [
    { id: "50", username: "admin_user" },
    { id: "51", username: "mod_user" },
  ],
  webhooks: [{ id: "70", name: "hook" }],
};

it("lists audit log entries with query params and paging cursors and preserves extra fields", async () => {
  const { client, request } = await harness({
    policy: new PPolicyEngine([], ["guild"], false),
    respond: () => AUDIT_LOG,
  });
  const result = await client.callTool({
    name: "discord_list_guild_audit_log_entries",
    arguments: {
      guild_id: "123",
      limit: 10,
      user_id: "50",
      target_id: "60",
      action_type: 1,
      before: "105",
      after: "85",
    },
  });
  const req = request();
  expect(req.method).toBe("GET");
  expect(req.url).toBe(
    "https://discord.com/api/v10/guilds/123/audit-logs?user_id=50&target_id=60&action_type=1&before=105&after=85&limit=10",
  );
  expect(result.structuredContent).toEqual({
    audit_log: AUDIT_LOG,
    next_before: "90",
    next_after: "100",
  });
});

it("returns null paging cursors on empty audit log entries", async () => {
  const { client } = await harness({
    policy: new PPolicyEngine([], ["guild"], false),
    respond: () => ({ audit_log_entries: [], users: [] }),
  });
  const result = await client.callTool({
    name: "discord_list_guild_audit_log_entries",
    arguments: { guild_id: "123" },
  });
  expect(result.structuredContent).toEqual({
    audit_log: { audit_log_entries: [], users: [] },
    next_before: null,
    next_after: null,
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
    message: "Discord rejected the request (HTTP 403): Missing Permissions",
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
  expect(errorOf(result)).toMatchObject({
    category: "not_found",
    status: 404,
    message: "Discord rejected the request (HTTP 404): Unknown Guild",
  });
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
  expect(request().url).toBe("https://discord.com/api/v10/guilds/123/audit-logs");
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
