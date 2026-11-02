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

const ONBOARDING = {
  guild_id: "123",
  prompts: [
    {
      id: "555",
      title: "What brings you here?",
      options: [
        {
          id: "666",
          title: "Gaming",
          description: "Play together",
          role_ids: ["777"],
          channel_ids: ["888"],
        },
      ],
      single_select: true,
      required: true,
      in_onboarding: true,
    },
  ],
  default_channel_ids: ["789"],
  enabled: true,
  mode: 0,
};

it("gets onboarding settings and retains all prompt details", async () => {
  const { client, request } = await harness({
    policy: new PPolicyEngine([], ["guild"], false),
    respond: () => ONBOARDING,
  });
  const result = await client.callTool({
    name: "discord_get_guild_onboarding",
    arguments: { guild_id: "123" },
  });
  expect(request().method).toBe("GET");
  expect(request().url).toBe("https://discord.com/api/v10/guilds/123/onboarding");
  expect(result.structuredContent).toEqual({ onboarding: ONBOARDING });
});

it("validates guild_id", async () => {
  const { client, makeRequest } = await harness({
    policy: new PPolicyEngine([], ["guild"], false),
  });
  const result = await client.callTool({
    name: "discord_get_guild_onboarding",
    arguments: { guild_id: "bad" },
  });
  expect(errorOf(result)).toMatchObject({ category: "validation" });
  expect(makeRequest).not.toHaveBeenCalled();
});

it("maps a 403 error to permission with ManageGuild", async () => {
  const { client } = await harness({
    policy: new PPolicyEngine([], ["guild"], false),
    makeRequest: async () => json({ message: "Missing Permissions", code: 50013 }, { status: 403 }),
  });
  const result = await client.callTool({
    name: "discord_get_guild_onboarding",
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
  const { client } = await harness({
    policy: new PPolicyEngine([], ["guild"], false),
    makeRequest: async () => json({ message: "Unknown Guild", code: 10004 }, { status: 404 }),
  });
  const result = await client.callTool({
    name: "discord_get_guild_onboarding",
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
    respond: () => ONBOARDING,
  });
  const result = await client.callTool({
    name: "discord_get_guild_onboarding",
    arguments: { guild_id: "123" },
  });
  expect(result.structuredContent).toEqual({ onboarding: ONBOARDING });
  expect(request().method).toBe("GET");
  expect(request().url).toBe("https://discord.com/api/v10/guilds/123/onboarding");
});

it("denies access when guild is not in allowlist", async () => {
  const { client, makeRequest } = await harness({
    policy: new PPolicyEngine(["999"], ["guild"], false),
  });
  const result = await client.callTool({
    name: "discord_get_guild_onboarding",
    arguments: { guild_id: "123" },
  });
  expect(errorOf(result)).toMatchObject({
    category: "policy",
    message: "Guild is not allowed",
  });
  expect(makeRequest).not.toHaveBeenCalled();
});
