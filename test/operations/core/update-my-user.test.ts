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

const UPDATED_USER = {
  id: "123456789012345678",
  username: "newname",
  avatar: "avatar_hash",
  banner: null,
  bot: true,
};

const SAMPLE_AVATAR =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

it("updates bot username and avatar with approval", async () => {
  const { client, request } = await harness({
    policy,
    respond: () => UPDATED_USER,
  });
  const result = await client.callTool({
    name: "discord_update_my_user",
    arguments: {
      username: "newname",
      avatar: SAMPLE_AVATAR,
      banner: null,
    },
  });
  expect(result.structuredContent).toEqual({ user: UPDATED_USER });
  const { url, method, body } = request();
  expect([method, url, JSON.parse(String(body))]).toEqual([
    "PATCH",
    "https://discord.com/api/v10/users/@me",
    {
      username: "newname",
      avatar: SAMPLE_AVATAR,
      banner: null,
    },
  ]);
});

it("rejects invalid avatar data URI format", async () => {
  const { client, makeRequest } = await harness({ policy });
  const result = await client.callTool({
    name: "discord_update_my_user",
    arguments: { avatar: "not-a-data-uri" },
  });
  expect(errorOf(result)).toMatchObject({ category: "validation" });
  expect(makeRequest).not.toHaveBeenCalled();
});

it("rejects invalid username length", async () => {
  const { client, makeRequest } = await harness({ policy });
  const result = await client.callTool({
    name: "discord_update_my_user",
    arguments: { username: "a" },
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
    name: "discord_update_my_user",
    arguments: { username: "newname" },
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
    makeRequest: async () => json({ message: "Unknown User", code: 10013 }, { status: 404 }),
  });
  const result = await client.callTool({
    name: "discord_update_my_user",
    arguments: { username: "newname" },
  });
  expect(errorOf(result)).toMatchObject({
    category: "not_found",
    status: 404,
    discord_code: 10013,
    retryable: false,
    message: "Discord rejected the request (HTTP 404): Unknown User",
    remediation: "Check the IDs in the request",
  });
});
