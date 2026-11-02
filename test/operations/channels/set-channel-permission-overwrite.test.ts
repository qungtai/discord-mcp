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

async function toolHarness(options: Parameters<typeof harness>[0] = {}) {
  return harness({
    ...options,
    policy: options.policy ?? new PPolicyEngine([], ["channels"], false),
  });
}

it("refuses to run when the client cannot ask for approval", async () => {
  const { client, makeRequest } = await harness({
    clientCapabilities: {},
    policy: new PPolicyEngine([], ["channels"], false),
  });
  const result = await client.callTool({
    name: "discord_set_channel_permission_overwrite",
    arguments: {
      channel_id: "100",
      overwrite_id: "200",
      type: 0,
    },
  });
  expect(errorOf(result)).toMatchObject({
    category: "policy",
    message: "This tool needs approval but the client does not support elicitation",
    remediation:
      "Use an MCP client that supports elicitation, or set DISCORD_MCP_APPROVAL=none to rely on the client's own tool approval",
  });
  expect(makeRequest).not.toHaveBeenCalled();
});

it("sets channel permission overwrite with literal method, route and body", async () => {
  const { client, request } = await toolHarness({
    respond: () => ({}),
  });
  const result = await client.callTool({
    name: "discord_set_channel_permission_overwrite",
    arguments: {
      channel_id: "100",
      overwrite_id: "200",
      type: 0,
      allow: "1024",
      deny: "2048",
      reason: "grant perms",
    },
  });
  expect(result.structuredContent).toEqual({
    channel_id: "100",
    overwrite_id: "200",
    updated: true,
  });
  const req = request();
  expect([req.method, req.url]).toEqual([
    "PUT",
    "https://discord.com/api/v10/channels/100/permissions/200",
  ]);
  expect(JSON.parse(String(req.body))).toEqual({
    type: 0,
    allow: "1024",
    deny: "2048",
  });
  expect(req.headers).toMatchObject({
    "X-Audit-Log-Reason": "grant%20perms",
  });
});

it("rejects invalid overwrite type", async () => {
  const { client, makeRequest } = await toolHarness();
  const result = await client.callTool({
    name: "discord_set_channel_permission_overwrite",
    arguments: {
      channel_id: "100",
      overwrite_id: "200",
      type: 2,
    },
  });
  expect(errorOf(result)).toMatchObject({ category: "validation" });
  expect(makeRequest).not.toHaveBeenCalled();
});

it("rejects non-digit bitfield string in allow or deny", async () => {
  const { client, makeRequest } = await toolHarness();
  const res1 = await client.callTool({
    name: "discord_set_channel_permission_overwrite",
    arguments: {
      channel_id: "100",
      overwrite_id: "200",
      type: 0,
      allow: "not_a_number",
    },
  });
  expect(errorOf(res1)).toMatchObject({ category: "validation" });

  const res2 = await client.callTool({
    name: "discord_set_channel_permission_overwrite",
    arguments: {
      channel_id: "100",
      overwrite_id: "200",
      type: 0,
      deny: "invalid",
    },
  });
  expect(errorOf(res2)).toMatchObject({ category: "validation" });
  expect(makeRequest).not.toHaveBeenCalled();
});

it("maps 403 to permission with ManageRoles requirement", async () => {
  const { client } = await toolHarness({
    makeRequest: async () => json({ message: "Missing Permissions", code: 50013 }, { status: 403 }),
  });
  const result = await client.callTool({
    name: "discord_set_channel_permission_overwrite",
    arguments: {
      channel_id: "100",
      overwrite_id: "200",
      type: 0,
    },
  });
  expect(errorOf(result)).toMatchObject({
    category: "permission",
    status: 403,
    discord_code: 50013,
    remediation: "Check the bot permissions; this tool needs ManageRoles",
  });
});

it("maps 404 to not_found", async () => {
  const { client } = await toolHarness({
    makeRequest: async () => json({ message: "Unknown Channel", code: 10003 }, { status: 404 }),
  });
  const result = await client.callTool({
    name: "discord_set_channel_permission_overwrite",
    arguments: {
      channel_id: "100",
      overwrite_id: "200",
      type: 0,
    },
  });
  expect(errorOf(result)).toMatchObject({
    category: "not_found",
    status: 404,
    remediation: "Check the IDs in the request",
  });
});

it("succeeds when channel is in allowlist and denies when it is not", async () => {
  const allowed = await toolHarness({
    policy: new PPolicyEngine(["500"], ["channels"], false),
    makeRequest: async (url) => {
      const u = String(url);
      if (u.endsWith("/channels/100")) return json({ id: "100", guild_id: "500" });
      return json({});
    },
  });
  const successResult = await allowed.client.callTool({
    name: "discord_set_channel_permission_overwrite",
    arguments: { channel_id: "100", overwrite_id: "200", type: 0 },
  });
  expect(successResult.structuredContent).toEqual({
    channel_id: "100",
    overwrite_id: "200",
    updated: true,
  });
  expect(allowed.makeRequest).toHaveBeenCalledTimes(2);
  expect(allowed.request(0)).toMatchObject({
    method: "GET",
    url: "https://discord.com/api/v10/channels/100",
  });
  expect(allowed.request(1)).toMatchObject({
    method: "PUT",
    url: "https://discord.com/api/v10/channels/100/permissions/200",
  });

  const denied = await toolHarness({
    policy: new PPolicyEngine(["500"], ["channels"], false),
    respond: () => ({ id: "100", guild_id: "999" }),
  });
  const deniedResult = await denied.client.callTool({
    name: "discord_set_channel_permission_overwrite",
    arguments: { channel_id: "100", overwrite_id: "200", type: 0 },
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
