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

const GUILD = { id: "123", name: "Updated Guild", description: "A great server" };

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

it("updates a guild and passes comprehensive literal body and reason when approval is bypassed", async () => {
  const { client, request } = await unapprovedHarness({ respond: () => GUILD });
  const result = await client.callTool({
    name: "discord_update_guild",
    arguments: {
      guild_id: "123",
      name: "Updated Guild",
      region: "us-central",
      verification_level: 2,
      default_message_notifications: 1,
      explicit_content_filter: 2,
      afk_channel_id: "456",
      afk_timeout: 300,
      icon: "data:image/png;base64,abc",
      home_header: "data:image/png;base64,header",
      system_channel_id: "457",
      system_channel_flags: 1,
      rules_channel_id: "458",
      public_updates_channel_id: "459",
      preferred_locale: "en-US",
      features: ["COMMUNITY"],
      description: "A great server",
      premium_progress_bar_enabled: true,
      safety_alerts_channel_id: "460",
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
  expect(JSON.parse(String(req.body))).toEqual({
    name: "Updated Guild",
    region: "us-central",
    verification_level: 2,
    default_message_notifications: 1,
    explicit_content_filter: 2,
    afk_channel_id: "456",
    afk_timeout: 300,
    icon: "data:image/png;base64,abc",
    home_header: "data:image/png;base64,header",
    system_channel_id: "457",
    system_channel_flags: 1,
    rules_channel_id: "458",
    public_updates_channel_id: "459",
    preferred_locale: "en-US",
    features: ["COMMUNITY"],
    description: "A great server",
    premium_progress_bar_enabled: true,
    safety_alerts_channel_id: "460",
  });
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
    message: "Discord rejected the request (HTTP 403): Missing Permissions",
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
    message: "Discord rejected the request (HTTP 404): Unknown Guild",
  });
});

it("allows update when guild and scoped channels are in allowlist", async () => {
  const base = (await PToolRegistry.load()).get("discord_update_guild");
  if (!base) throw new Error("Missing tool");
  const registry = new PToolRegistry();
  registry.register({ ...base, approval: false });
  const { client, request } = await harness({
    registry,
    policy: new PPolicyEngine(["123"], ["guild"], false),
    makeRequest: async (url) => {
      if (String(url).endsWith("/channels/456")) return json({ id: "456", guild_id: "123" });
      return json(GUILD);
    },
  });
  const result = await client.callTool({
    name: "discord_update_guild",
    arguments: { guild_id: "123", name: "Updated Guild", afk_channel_id: "456" },
  });
  expect(result.structuredContent).toEqual({ guild: GUILD });
  expect(request(1).method).toBe("PATCH");
  expect(request(1).url).toBe("https://discord.com/api/v10/guilds/123");
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

it("denies update when a scoped channel belongs to another guild before write", async () => {
  const base = (await PToolRegistry.load()).get("discord_update_guild");
  if (!base) throw new Error("Missing tool");
  const registry = new PToolRegistry();
  registry.register({ ...base, approval: false });
  const { client, makeRequest } = await harness({
    registry,
    policy: new PPolicyEngine(["123"], ["guild"], false),
    makeRequest: async (url) => {
      if (String(url).endsWith("/channels/456")) return json({ id: "456", guild_id: "999" });
      return json(GUILD);
    },
  });
  const result = await client.callTool({
    name: "discord_update_guild",
    arguments: { guild_id: "123", name: "Updated Guild", afk_channel_id: "456" },
  });
  expect(errorOf(result)).toMatchObject({
    category: "policy",
    message: "Guild is not allowed",
  });
  // Verified that only the GET lookup was made, no PATCH write was sent!
  expect(makeRequest).toHaveBeenCalledTimes(1);
});
