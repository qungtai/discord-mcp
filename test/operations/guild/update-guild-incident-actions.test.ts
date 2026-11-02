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

const INCIDENTS = {
  invites_disabled_until: "2026-11-04T00:00:00.000Z",
  dms_disabled_until: null,
};

it("refuses to run when the client cannot ask for approval", async () => {
  const tool = (await PToolRegistry.load()).get("discord_update_guild_incident_actions");
  expect(tool?.effect).toBe("destructive");
  expect(tool?.approval).toBe(true);

  const { client, makeRequest } = await harness({
    clientCapabilities: {},
    policy: new PPolicyEngine([], ["guild"], false),
  });
  const result = await client.callTool({
    name: "discord_update_guild_incident_actions",
    arguments: { guild_id: "123", invites_disabled_until: "2026-11-04T00:00:00.000Z" },
  });
  expect(errorOf(result)).toMatchObject({
    category: "policy",
    message: "This tool needs approval but the client does not support elicitation",
  });
  expect(makeRequest).not.toHaveBeenCalled();
});

it("updates incident actions after the client accepts approval", async () => {
  const base = (await PToolRegistry.load()).get("discord_update_guild_incident_actions");
  if (!base) throw new Error("Missing tool");
  const registry = new PToolRegistry();
  registry.register(base);

  const { client, request } = await harness({
    registry,
    policy: new PPolicyEngine([], ["guild"], false),
    respond: () => INCIDENTS,
  });
  const result = await client.callTool({
    name: "discord_update_guild_incident_actions",
    arguments: {
      guild_id: "123",
      invites_disabled_until: "2026-11-04T00:00:00.000Z",
      dms_disabled_until: null,
    },
  });
  expect(result.structuredContent).toEqual({ incident_actions: INCIDENTS });
  const req = request();
  expect(req.method).toBe("PUT");
  expect(req.url).toBe("https://discord.com/api/v10/guilds/123/incident-actions");
  expect(JSON.parse(String(req.body))).toEqual({
    invites_disabled_until: "2026-11-04T00:00:00.000Z",
    dms_disabled_until: null,
  });
});

it("validates timestamp format", async () => {
  const base = (await PToolRegistry.load()).get("discord_update_guild_incident_actions");
  if (!base) throw new Error("Missing tool");
  const registry = new PToolRegistry();
  registry.register(base);

  const { client, makeRequest } = await harness({
    registry,
    policy: new PPolicyEngine([], ["guild"], false),
  });
  const result = await client.callTool({
    name: "discord_update_guild_incident_actions",
    arguments: { guild_id: "123", invites_disabled_until: "not-a-datetime" },
  });
  expect(errorOf(result)).toMatchObject({ category: "validation" });
  expect(makeRequest).not.toHaveBeenCalled();
});

it("validates guild_id format", async () => {
  const base = (await PToolRegistry.load()).get("discord_update_guild_incident_actions");
  if (!base) throw new Error("Missing tool");
  const registry = new PToolRegistry();
  registry.register(base);

  const { client, makeRequest } = await harness({
    registry,
    policy: new PPolicyEngine([], ["guild"], false),
  });
  const result = await client.callTool({
    name: "discord_update_guild_incident_actions",
    arguments: { guild_id: "abc" },
  });
  expect(errorOf(result)).toMatchObject({ category: "validation" });
  expect(makeRequest).not.toHaveBeenCalled();
});

it("maps a 403 error to permission with ManageGuild", async () => {
  const base = (await PToolRegistry.load()).get("discord_update_guild_incident_actions");
  if (!base) throw new Error("Missing tool");
  const registry = new PToolRegistry();
  registry.register(base);

  const { client } = await harness({
    registry,
    policy: new PPolicyEngine([], ["guild"], false),
    makeRequest: async () => json({ message: "Missing Permissions", code: 50013 }, { status: 403 }),
  });
  const result = await client.callTool({
    name: "discord_update_guild_incident_actions",
    arguments: { guild_id: "123" },
  });
  expect(errorOf(result)).toMatchObject({
    category: "permission",
    status: 403,
    message: "Discord rejected the request (HTTP 403): Missing Permissions",
    remediation: "Check the bot permissions; this tool needs ManageGuild",
  });
});

it("maps a 404 error to not_found", async () => {
  const base = (await PToolRegistry.load()).get("discord_update_guild_incident_actions");
  if (!base) throw new Error("Missing tool");
  const registry = new PToolRegistry();
  registry.register(base);

  const { client } = await harness({
    registry,
    policy: new PPolicyEngine([], ["guild"], false),
    makeRequest: async () => json({ message: "Unknown Guild", code: 10004 }, { status: 404 }),
  });
  const result = await client.callTool({
    name: "discord_update_guild_incident_actions",
    arguments: { guild_id: "123" },
  });
  expect(errorOf(result)).toMatchObject({
    category: "not_found",
    status: 404,
    message: "Discord rejected the request (HTTP 404): Unknown Guild",
  });
});

it("allows access when guild is in allowlist", async () => {
  const base = (await PToolRegistry.load()).get("discord_update_guild_incident_actions");
  if (!base) throw new Error("Missing tool");
  const registry = new PToolRegistry();
  registry.register(base);

  const { client, request } = await harness({
    registry,
    policy: new PPolicyEngine(["123"], ["guild"], false),
    respond: () => INCIDENTS,
  });
  const result = await client.callTool({
    name: "discord_update_guild_incident_actions",
    arguments: { guild_id: "123" },
  });
  expect(result.structuredContent).toEqual({ incident_actions: INCIDENTS });
  expect(request().method).toBe("PUT");
  expect(request().url).toBe("https://discord.com/api/v10/guilds/123/incident-actions");
});

it("denies access when guild is not in allowlist", async () => {
  const base = (await PToolRegistry.load()).get("discord_update_guild_incident_actions");
  if (!base) throw new Error("Missing tool");
  const registry = new PToolRegistry();
  registry.register(base);

  const { client, makeRequest } = await harness({
    registry,
    policy: new PPolicyEngine(["999"], ["guild"], false),
  });
  const result = await client.callTool({
    name: "discord_update_guild_incident_actions",
    arguments: { guild_id: "123" },
  });
  expect(errorOf(result)).toMatchObject({
    category: "policy",
    message: "Guild is not allowed",
  });
  expect(makeRequest).not.toHaveBeenCalled();
});
