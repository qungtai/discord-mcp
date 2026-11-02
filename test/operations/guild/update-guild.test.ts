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

const GUILD = { id: "123", name: "Updated Guild" };

async function unapprovedHarness(options = {}) {
  const base = (await PToolRegistry.load()).get("discord_update_guild");
  if (!base) throw new Error("Missing tool");
  const registry = new PToolRegistry();
  registry.register({ ...base, approval: false });
  return harness({
    registry,
    policy: new PPolicyEngine([], ["guild"], false),
    ...options,
  });
}

it("is gated pending approval support by default", async () => {
  const tool = (await PToolRegistry.load()).get("discord_update_guild");
  expect(tool?.effect).toBe("destructive");
  expect(tool?.approval).toBe(true);

  const { client, makeRequest } = await harness({
    policy: new PPolicyEngine([], ["guild"], false),
  });
  const result = await client.callTool({
    name: "discord_update_guild",
    arguments: { guild_id: "123", name: "Updated Guild" },
  });
  expect(errorOf(result)).toMatchObject({
    category: "policy",
    message: "This tool requires approval support",
  });
  expect(makeRequest).not.toHaveBeenCalled();
});

it("updates a guild and passes literal body and reason when approval is bypassed", async () => {
  const { client, request } = await unapprovedHarness({ respond: () => GUILD });
  const result = await client.callTool({
    name: "discord_update_guild",
    arguments: {
      guild_id: "123",
      name: "Updated Guild",
      reason: "branding update",
    },
  });
  expect(result.structuredContent).toEqual({ guild: GUILD });
  const req = request();
  expect(req.method).toBe("PATCH");
  expect(req.url).toBe("https://discord.com/api/v10/guilds/123");
  expect(new Headers(req.headers as HeadersInit).get("x-audit-log-reason")).toBe(
    "branding%20update",
  );
  expect(JSON.parse(String(req.body))).toEqual({ name: "Updated Guild" });
});

it("validates input name min length", async () => {
  const { client, makeRequest } = await unapprovedHarness();
  const result = await client.callTool({
    name: "discord_update_guild",
    arguments: { guild_id: "123", name: "a" },
  });
  expect(errorOf(result)).toMatchObject({ category: "validation" });
  expect(makeRequest).not.toHaveBeenCalled();
});

it("maps a 403 error to permission with required permissions", async () => {
  const { client } = await unapprovedHarness({
    makeRequest: async () => json({ message: "Missing Permissions", code: 50013 }, { status: 403 }),
  });
  const result = await client.callTool({
    name: "discord_update_guild",
    arguments: { guild_id: "123", name: "New Name" },
  });
  expect(errorOf(result)).toMatchObject({
    category: "permission",
    status: 403,
    remediation: "Check the bot permissions; this tool needs ManageGuild",
  });
});

it("maps a 404 error to not_found", async () => {
  const { client } = await unapprovedHarness({
    makeRequest: async () => json({ message: "Unknown Guild", code: 10004 }, { status: 404 }),
  });
  const result = await client.callTool({
    name: "discord_update_guild",
    arguments: { guild_id: "123", name: "New Name" },
  });
  expect(errorOf(result)).toMatchObject({
    category: "not_found",
    status: 404,
  });
});

it("allows update when guild is in allowlist", async () => {
  const base = (await PToolRegistry.load()).get("discord_update_guild");
  if (!base) throw new Error("Missing tool");
  const registry = new PToolRegistry();
  registry.register({ ...base, approval: false });
  const { client, request } = await harness({
    registry,
    policy: new PPolicyEngine(["123"], ["guild"], false),
    respond: () => GUILD,
  });
  const result = await client.callTool({
    name: "discord_update_guild",
    arguments: { guild_id: "123", name: "Updated Guild" },
  });
  expect(result.structuredContent).toEqual({ guild: GUILD });
  expect(request().method).toBe("PATCH");
});

it("denies update when guild is not in allowlist", async () => {
  const base = (await PToolRegistry.load()).get("discord_update_guild");
  if (!base) throw new Error("Missing tool");
  const registry = new PToolRegistry();
  registry.register({ ...base, approval: false });
  const { client, makeRequest } = await harness({
    registry,
    policy: new PPolicyEngine(["999"], ["guild"], false),
  });
  const result = await client.callTool({
    name: "discord_update_guild",
    arguments: { guild_id: "123", name: "Updated Guild" },
  });
  expect(errorOf(result)).toMatchObject({
    category: "policy",
    message: "Guild is not allowed",
  });
  expect(makeRequest).not.toHaveBeenCalled();
});
