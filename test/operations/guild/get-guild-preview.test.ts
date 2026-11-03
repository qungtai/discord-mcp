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

const PREVIEW = {
  id: "123",
  name: "Preview Guild",
  approximate_member_count: 50,
};

it("gets guild preview and returns structured content", async () => {
  const { client, request } = await harness({
    policy: new PPolicyEngine([], ["guild"], false),
    respond: () => PREVIEW,
  });
  const result = await client.callTool({
    name: "discord_get_guild_preview",
    arguments: { guild_id: "123" },
  });
  expect(request().method).toBe("GET");
  expect(request().url).toBe("https://discord.com/api/v10/guilds/123/preview");
  expect(result.structuredContent).toEqual({ guild_preview: PREVIEW });
});

it("validates guild_id format", async () => {
  const { client, makeRequest } = await harness({
    policy: new PPolicyEngine([], ["guild"], false),
  });
  const result = await client.callTool({
    name: "discord_get_guild_preview",
    arguments: { guild_id: "not-a-snowflake" },
  });
  expect(errorOf(result)).toMatchObject({ category: "validation" });
  expect(makeRequest).not.toHaveBeenCalled();
});

it("maps a 403 error to permission", async () => {
  const { client } = await harness({
    policy: new PPolicyEngine([], ["guild"], false),
    makeRequest: async () => json({ message: "Missing Permissions", code: 50013 }, { status: 403 }),
  });
  const result = await client.callTool({
    name: "discord_get_guild_preview",
    arguments: { guild_id: "123" },
  });
  expect(errorOf(result)).toMatchObject({ category: "permission", status: 403 });
});

it("maps a 404 error to not_found", async () => {
  const { client } = await harness({
    policy: new PPolicyEngine([], ["guild"], false),
    makeRequest: async () => json({ message: "Unknown Guild", code: 10004 }, { status: 404 }),
  });
  const result = await client.callTool({
    name: "discord_get_guild_preview",
    arguments: { guild_id: "123" },
  });
  expect(errorOf(result)).toMatchObject({ category: "not_found", status: 404 });
});

it("allows access when guild is in allowlist", async () => {
  const { client, request } = await harness({
    policy: new PPolicyEngine(["123"], ["guild"], false),
    respond: () => PREVIEW,
  });
  const result = await client.callTool({
    name: "discord_get_guild_preview",
    arguments: { guild_id: "123" },
  });
  expect(result.structuredContent).toEqual({ guild_preview: PREVIEW });
  expect(request().method).toBe("GET");
});

it("denies access when guild is not in allowlist", async () => {
  const { client, makeRequest } = await harness({
    policy: new PPolicyEngine(["999"], ["guild"], false),
  });
  const result = await client.callTool({
    name: "discord_get_guild_preview",
    arguments: { guild_id: "123" },
  });
  expect(errorOf(result)).toMatchObject({
    category: "policy",
    message: "Guild is not allowed",
  });
  expect(makeRequest).not.toHaveBeenCalled();
});
