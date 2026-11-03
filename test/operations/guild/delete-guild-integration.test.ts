import type { ResponseLike } from "@discordjs/rest";
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

const empty204 = () => new Response(null, { status: 204 }) as unknown as ResponseLike;

it("is gated pending approval support by default", async () => {
  const tool = (await PToolRegistry.load()).get("discord_delete_guild_integration");
  expect(tool?.effect).toBe("destructive");
  expect(tool?.approval).toBe(true);

  const { client, makeRequest } = await harness({
    policy: new PPolicyEngine([], ["guild"], false),
  });
  const result = await client.callTool({
    name: "discord_delete_guild_integration",
    arguments: { guild_id: "123", integration_id: "456" },
  });
  expect(errorOf(result)).toMatchObject({
    category: "policy",
    message: "This tool requires approval support",
  });
  expect(makeRequest).not.toHaveBeenCalled();
});

it("deletes an integration with reason when approval is bypassed", async () => {
  const base = (await PToolRegistry.load()).get("discord_delete_guild_integration");
  if (!base) throw new Error("Missing tool");
  const registry = new PToolRegistry();
  registry.register({ ...base, approval: false });

  const { client, request } = await harness({
    registry,
    policy: new PPolicyEngine([], ["guild"], false),
    makeRequest: async () => empty204(),
  });
  const result = await client.callTool({
    name: "discord_delete_guild_integration",
    arguments: {
      guild_id: "123",
      integration_id: "456",
      reason: "remove old integration",
    },
  });
  expect(result.structuredContent).toEqual({
    deleted: true,
    guild_id: "123",
    integration_id: "456",
  });
  const req = request();
  expect(req.method).toBe("DELETE");
  expect(req.url).toBe("https://discord.com/api/v10/guilds/123/integrations/456");
  expect(new Headers(req.headers as HeadersInit).get("x-audit-log-reason")).toBe(
    "remove%20old%20integration",
  );
});

it("validates integration_id", async () => {
  const base = (await PToolRegistry.load()).get("discord_delete_guild_integration");
  if (!base) throw new Error("Missing tool");
  const registry = new PToolRegistry();
  registry.register({ ...base, approval: false });

  const { client, makeRequest } = await harness({
    registry,
    policy: new PPolicyEngine([], ["guild"], false),
  });
  const result = await client.callTool({
    name: "discord_delete_guild_integration",
    arguments: { guild_id: "123", integration_id: "invalid" },
  });
  expect(errorOf(result)).toMatchObject({ category: "validation" });
  expect(makeRequest).not.toHaveBeenCalled();
});

it("maps a 403 error to permission with ManageGuild", async () => {
  const base = (await PToolRegistry.load()).get("discord_delete_guild_integration");
  if (!base) throw new Error("Missing tool");
  const registry = new PToolRegistry();
  registry.register({ ...base, approval: false });

  const { client } = await harness({
    registry,
    policy: new PPolicyEngine([], ["guild"], false),
    makeRequest: async () => json({ message: "Missing Permissions", code: 50013 }, { status: 403 }),
  });
  const result = await client.callTool({
    name: "discord_delete_guild_integration",
    arguments: { guild_id: "123", integration_id: "456" },
  });
  expect(errorOf(result)).toMatchObject({
    category: "permission",
    status: 403,
    remediation: "Check the bot permissions; this tool needs ManageGuild",
  });
});

it("maps a 404 error to not_found", async () => {
  const base = (await PToolRegistry.load()).get("discord_delete_guild_integration");
  if (!base) throw new Error("Missing tool");
  const registry = new PToolRegistry();
  registry.register({ ...base, approval: false });

  const { client } = await harness({
    registry,
    policy: new PPolicyEngine([], ["guild"], false),
    makeRequest: async () => json({ message: "Unknown Integration", code: 10004 }, { status: 404 }),
  });
  const result = await client.callTool({
    name: "discord_delete_guild_integration",
    arguments: { guild_id: "123", integration_id: "456" },
  });
  expect(errorOf(result)).toMatchObject({ category: "not_found", status: 404 });
});

it("allows deletion when guild is in allowlist", async () => {
  const base = (await PToolRegistry.load()).get("discord_delete_guild_integration");
  if (!base) throw new Error("Missing tool");
  const registry = new PToolRegistry();
  registry.register({ ...base, approval: false });

  const { client, request } = await harness({
    registry,
    policy: new PPolicyEngine(["123"], ["guild"], false),
    makeRequest: async () => empty204(),
  });
  const result = await client.callTool({
    name: "discord_delete_guild_integration",
    arguments: { guild_id: "123", integration_id: "456" },
  });
  expect(result.structuredContent).toEqual({
    deleted: true,
    guild_id: "123",
    integration_id: "456",
  });
  expect(request().method).toBe("DELETE");
});

it("denies deletion when guild is not in allowlist", async () => {
  const base = (await PToolRegistry.load()).get("discord_delete_guild_integration");
  if (!base) throw new Error("Missing tool");
  const registry = new PToolRegistry();
  registry.register({ ...base, approval: false });

  const { client, makeRequest } = await harness({
    registry,
    policy: new PPolicyEngine(["999"], ["guild"], false),
  });
  const result = await client.callTool({
    name: "discord_delete_guild_integration",
    arguments: { guild_id: "123", integration_id: "456" },
  });
  expect(errorOf(result)).toMatchObject({
    category: "policy",
    message: "Guild is not allowed",
  });
  expect(makeRequest).not.toHaveBeenCalled();
});
