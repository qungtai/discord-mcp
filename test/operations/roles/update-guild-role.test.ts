import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { PPolicyEngine } from "../../../src/core/policy.js";
import { defineTool, PToolRegistry } from "../../../src/core/tool-registry.js";
import { updateGuildRole } from "../../../src/operations/roles/update-guild-role.js";
import { errorOf, harness, json } from "../../support/harness.js";

beforeEach(() => {
  vi.spyOn(process.stderr, "write").mockReturnValue(true);
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const policy = new PPolicyEngine([], ["core", "roles"], false);

const UPDATED_ROLE = {
  id: "456",
  name: "SuperAdmin",
  color: 65280,
  position: 2,
  permissions: "32",
  managed: false,
};

it("refuses update without approval support", async () => {
  const { client, makeRequest } = await harness({ policy });
  const result = await client.callTool({
    name: "discord_update_guild_role",
    arguments: {
      guild_id: "123",
      role_id: "456",
      name: "New Name",
    },
  });
  expect(errorOf(result)).toMatchObject({
    category: "policy",
    message: "This tool requires approval support",
    remediation: "Wait for the approval flow",
  });
  expect(makeRequest).not.toHaveBeenCalled();
});

it("rejects invalid role_id", async () => {
  const { client, makeRequest } = await harness({ policy });
  const result = await client.callTool({
    name: "discord_update_guild_role",
    arguments: {
      guild_id: "123",
      role_id: "invalid",
    },
  });
  expect(errorOf(result)).toMatchObject({ category: "validation" });
  expect(makeRequest).not.toHaveBeenCalled();
});

function unapprovedRegistry() {
  const reg = new PToolRegistry();
  reg.register({
    ...updateGuildRole,
    approval: false,
  });
  return reg;
}

it("updates a guild role with reason and null fields when approval is satisfied", async () => {
  const { client, request } = await harness({
    policy,
    registry: unapprovedRegistry(),
    respond: () => UPDATED_ROLE,
  });
  const result = await client.callTool({
    name: "discord_update_guild_role",
    arguments: {
      guild_id: "123",
      role_id: "456",
      name: "SuperAdmin",
      color: 65280,
      icon: null,
      reason: "promotion",
    },
  });
  expect(result.structuredContent).toEqual({ role: UPDATED_ROLE });
  const { url, method, body, headers } = request();
  expect([method, url]).toEqual(["PATCH", "https://discord.com/api/v10/guilds/123/roles/456"]);
  expect(headers).toMatchObject({ "X-Audit-Log-Reason": "promotion" });
  expect(JSON.parse(String(body))).toEqual({
    name: "SuperAdmin",
    color: 65280,
    icon: null,
  });
});

it("allows guilds in the allowlist", async () => {
  const { client } = await harness({
    policy: new PPolicyEngine(["123"], ["core", "roles"], false),
    registry: unapprovedRegistry(),
    respond: () => UPDATED_ROLE,
  });
  const result = await client.callTool({
    name: "discord_update_guild_role",
    arguments: { guild_id: "123", role_id: "456", name: "SuperAdmin" },
  });
  expect(result.structuredContent).toEqual({ role: UPDATED_ROLE });
});

it("blocks guilds outside the allowlist", async () => {
  const { client, makeRequest } = await harness({
    policy: new PPolicyEngine(["999"], ["core", "roles"], false),
    registry: unapprovedRegistry(),
  });
  const result = await client.callTool({
    name: "discord_update_guild_role",
    arguments: { guild_id: "123", role_id: "456", name: "SuperAdmin" },
  });
  expect(errorOf(result)).toMatchObject({
    category: "policy",
    message: "Guild is not allowed",
  });
  expect(makeRequest).not.toHaveBeenCalled();
});

it("maps 403 to permission error", async () => {
  const { client } = await harness({
    policy,
    registry: unapprovedRegistry(),
    makeRequest: async () => json({ message: "Missing Permissions", code: 50013 }, { status: 403 }),
  });
  const result = await client.callTool({
    name: "discord_update_guild_role",
    arguments: { guild_id: "123", role_id: "456", name: "SuperAdmin" },
  });
  expect(errorOf(result)).toMatchObject({
    category: "permission",
    status: 403,
  });
});
