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

const policy = new PPolicyEngine([], ["core"], false);

it("leaves guild with approval", async () => {
  const { client, request } = await harness({
    policy,
    respond: () => undefined,
  });
  const result = await client.callTool({
    name: "discord_leave_guild",
    arguments: { guild_id: "123456789012345678" },
  });
  expect(result.structuredContent).toEqual({
    deleted: true,
    guild_id: "123456789012345678",
  });
  const { url, method, body } = request();
  expect([method, url, body]).toEqual([
    "DELETE",
    "https://discord.com/api/v10/users/@me/guilds/123456789012345678",
    undefined,
  ]);
});

it("succeeds when guild is in allowlist", async () => {
  const { client, request } = await harness({
    policy: new PPolicyEngine(["123456789012345678"], ["core"], false),
    respond: () => undefined,
  });
  const result = await client.callTool({
    name: "discord_leave_guild",
    arguments: { guild_id: "123456789012345678" },
  });
  expect(result.structuredContent).toEqual({
    deleted: true,
    guild_id: "123456789012345678",
  });
  expect(request().method).toBe("DELETE");
});

it("denies when guild is outside allowlist without sending request", async () => {
  const { client, makeRequest } = await harness({
    policy: new PPolicyEngine(["999999999999999999"], ["core"], false),
  });
  const result = await client.callTool({
    name: "discord_leave_guild",
    arguments: { guild_id: "123456789012345678" },
  });
  expect(errorOf(result)).toMatchObject({
    category: "policy",
    retryable: false,
    message: "Guild is not allowed",
    remediation: "Choose an allowed guild",
  });
  expect(makeRequest).not.toHaveBeenCalled();
});

it("rejects non-snowflake guild_id", async () => {
  const { client, makeRequest } = await harness({ policy });
  const result = await client.callTool({
    name: "discord_leave_guild",
    arguments: { guild_id: "invalid" },
  });
  expect(errorOf(result)).toMatchObject({ category: "validation" });
  expect(makeRequest).not.toHaveBeenCalled();
});

it("maps 403 to permission error", async () => {
  const { client } = await harness({
    policy,
    makeRequest: async () => json({ message: "Missing Access", code: 50001 }, { status: 403 }),
  });
  const result = await client.callTool({
    name: "discord_leave_guild",
    arguments: { guild_id: "123456789012345678" },
  });
  expect(errorOf(result)).toMatchObject({
    category: "permission",
    status: 403,
    discord_code: 50001,
    retryable: false,
    message: "Discord rejected the request (HTTP 403): Missing Access",
    remediation: "Check the bot permissions",
  });
});

it("maps 404 to not_found error", async () => {
  const { client } = await harness({
    policy,
    makeRequest: async () => json({ message: "Unknown Guild", code: 10004 }, { status: 404 }),
  });
  const result = await client.callTool({
    name: "discord_leave_guild",
    arguments: { guild_id: "123456789012345678" },
  });
  expect(errorOf(result)).toMatchObject({
    category: "not_found",
    status: 404,
    discord_code: 10004,
    retryable: false,
    message: "Discord rejected the request (HTTP 404): Unknown Guild",
    remediation: "Check the IDs in the request",
  });
});
