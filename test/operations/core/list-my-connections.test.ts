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

const CONNECTIONS = [
  {
    id: "connection_1",
    name: "octocat",
    type: "github",
    verified: true,
    friend_sync: false,
    show_activity: true,
    two_way_link: false,
    visibility: 1,
  },
];

it("lists bot user connections", async () => {
  const { client, request } = await harness({
    policy,
    respond: () => CONNECTIONS,
  });
  const result = await client.callTool({
    name: "discord_list_my_connections",
    arguments: {},
  });
  expect(result.structuredContent).toEqual({ connections: CONNECTIONS });
  const { url, method, body } = request();
  expect([method, url, body]).toEqual([
    "GET",
    "https://discord.com/api/v10/users/@me/connections",
    null,
  ]);
});

it("rejects unknown arguments", async () => {
  const { client, makeRequest } = await harness({ policy });
  const result = await client.callTool({
    name: "discord_list_my_connections",
    arguments: { extra: "field" },
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
    name: "discord_list_my_connections",
    arguments: {},
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
    name: "discord_list_my_connections",
    arguments: {},
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
