import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { PPolicyEngine } from "../../../src/core/policy.js";
import { PToolRegistry } from "../../../src/core/tool-registry.js";
import { errorOf, harness, json } from "../../support/harness.js";

beforeEach(() => {
  vi.spyOn(process.stderr, "write").mockReturnValue(true);
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

async function bypassApprovalHarness(options: Parameters<typeof harness>[0] = {}) {
  const all = (await PToolRegistry.load()).list();
  const reg = new PToolRegistry();
  for (const t of all) {
    reg.register(
      t.name === "discord_delete_channel_permission_overwrite" ? { ...t, approval: false } : t,
    );
  }
  return harness({
    ...options,
    registry: reg,
    policy: options.policy ?? new PPolicyEngine([], ["channels"], false),
  });
}

it("refuses call through default approval gate without sending any request", async () => {
  const { client, makeRequest } = await harness({
    policy: new PPolicyEngine([], ["channels"], false),
  });
  const result = await client.callTool({
    name: "discord_delete_channel_permission_overwrite",
    arguments: {
      channel_id: "100",
      overwrite_id: "200",
    },
  });
  expect(errorOf(result)).toMatchObject({
    category: "policy",
    message: "This tool requires approval support",
    remediation: "Wait for the approval flow",
  });
  expect(makeRequest).not.toHaveBeenCalled();
});

it("deletes channel permission overwrite with literal method, route and headers", async () => {
  const { client, request } = await bypassApprovalHarness({
    respond: () => ({}),
  });
  const result = await client.callTool({
    name: "discord_delete_channel_permission_overwrite",
    arguments: {
      channel_id: "100",
      overwrite_id: "200",
      reason: "remove overwrite",
    },
  });
  expect(result.structuredContent).toEqual({
    deleted: true,
    channel_id: "100",
    overwrite_id: "200",
  });
  const req = request();
  expect([req.method, req.url]).toEqual([
    "DELETE",
    "https://discord.com/api/v10/channels/100/permissions/200",
  ]);
  expect(req.headers).toMatchObject({
    "X-Audit-Log-Reason": "remove%20overwrite",
  });
});

it("maps 403 to permission with ManageRoles requirement", async () => {
  const { client } = await bypassApprovalHarness({
    makeRequest: async () => json({ message: "Missing Permissions", code: 50013 }, { status: 403 }),
  });
  const result = await client.callTool({
    name: "discord_delete_channel_permission_overwrite",
    arguments: { channel_id: "100", overwrite_id: "200" },
  });
  expect(errorOf(result)).toMatchObject({
    category: "permission",
    status: 403,
    discord_code: 50013,
    remediation: "Check the bot permissions; this tool needs ManageRoles",
  });
});

it("maps 404 to not_found", async () => {
  const { client } = await bypassApprovalHarness({
    makeRequest: async () => json({ message: "Unknown Overwrite", code: 10003 }, { status: 404 }),
  });
  const result = await client.callTool({
    name: "discord_delete_channel_permission_overwrite",
    arguments: { channel_id: "100", overwrite_id: "200" },
  });
  expect(errorOf(result)).toMatchObject({
    category: "not_found",
    status: 404,
  });
});

it("succeeds when channel is in allowlist and denies when it is not", async () => {
  const allowed = await bypassApprovalHarness({
    policy: new PPolicyEngine(["500"], ["channels"], false),
    makeRequest: async (url) => {
      const u = String(url);
      if (u.endsWith("/channels/100")) return json({ id: "100", guild_id: "500" });
      return json({});
    },
  });
  const successResult = await allowed.client.callTool({
    name: "discord_delete_channel_permission_overwrite",
    arguments: { channel_id: "100", overwrite_id: "200" },
  });
  expect(successResult.structuredContent).toEqual({
    deleted: true,
    channel_id: "100",
    overwrite_id: "200",
  });
  expect(allowed.makeRequest).toHaveBeenCalledTimes(2);
  expect(allowed.request(0)).toMatchObject({
    method: "GET",
    url: "https://discord.com/api/v10/channels/100",
  });
  expect(allowed.request(1)).toMatchObject({
    method: "DELETE",
    url: "https://discord.com/api/v10/channels/100/permissions/200",
  });

  const denied = await bypassApprovalHarness({
    policy: new PPolicyEngine(["500"], ["channels"], false),
    respond: () => ({ id: "100", guild_id: "999" }),
  });
  const deniedResult = await denied.client.callTool({
    name: "discord_delete_channel_permission_overwrite",
    arguments: { channel_id: "100", overwrite_id: "200" },
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
