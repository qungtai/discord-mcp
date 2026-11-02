import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { PPolicyEngine } from "../../../src/core/policy.js";
import { PToolRegistry } from "../../../src/core/tool-registry.js";
import { errorOf, json } from "../../support/harness.js";
import { empty204, setupTestLifecycle, singleToolRegistry, threadHarness } from "./support.js";

beforeEach(setupTestLifecycle);
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const args = { channel_id: "101", user_id: "501" };

it("refuses to run when the client cannot ask for approval", async () => {
  const tool = (await PToolRegistry.load()).get("discord_delete_thread_member");
  expect(tool?.effect).toBe("destructive");
  expect(tool?.approval).toBe(true);

  const { client, makeRequest } = await threadHarness({ clientCapabilities: {} });
  const result = await client.callTool({
    name: "discord_delete_thread_member",
    arguments: args,
  });
  expect(errorOf(result)).toMatchObject({
    category: "policy",
    message: "This tool needs approval but the client does not support elicitation",
    remediation:
      "Use an MCP client that supports elicitation, or set DISCORD_MCP_APPROVAL=none to rely on the client's own tool approval",
  });
  expect(makeRequest).not.toHaveBeenCalled();
});

it("deletes a thread member and returns deleted status after the client accepts approval", async () => {
  const registry = await singleToolRegistry("discord_delete_thread_member");
  const { client, request } = await threadHarness({
    registry,
    makeRequest: async () => empty204(),
  });
  const result = await client.callTool({
    name: "discord_delete_thread_member",
    arguments: args,
  });
  expect(result.structuredContent).toEqual({ deleted: true, channel_id: "101", user_id: "501" });
  const req = request();
  expect([req.method, req.url]).toEqual([
    "DELETE",
    "https://discord.com/api/v10/channels/101/thread-members/501",
  ]);
});

it("validates channel_id and user_id format", async () => {
  const { client, makeRequest } = await threadHarness();
  const result = await client.callTool({
    name: "discord_delete_thread_member",
    arguments: { channel_id: "not-snowflake", user_id: "501" },
  });
  expect(errorOf(result)).toMatchObject({ category: "validation" });
  expect(makeRequest).not.toHaveBeenCalled();
});

it("handles 403 error with literal message", async () => {
  const registry = await singleToolRegistry("discord_delete_thread_member");
  const { pipeline } = await threadHarness({
    registry,
    makeRequest: async () => json({ message: "Missing Access", code: 50001 }, { status: 403 }),
  });
  const result = await pipeline.call("discord_delete_thread_member", args, {
    approve: async () => true,
  });
  expect(result).toMatchObject({
    ok: false,
    error: {
      category: "permission",
      status: 403,
      discord_code: 50001,
      message: "Discord rejected the request (HTTP 403): Missing Access",
    },
  });
});

it("handles 404 error with literal message", async () => {
  const registry = await singleToolRegistry("discord_delete_thread_member");
  const { client } = await threadHarness({
    registry,
    makeRequest: async () => json({ message: "Unknown Channel", code: 10003 }, { status: 404 }),
  });
  const result = await client.callTool({
    name: "discord_delete_thread_member",
    arguments: {
      channel_id: "999",
      user_id: "501",
    },
  });
  expect(errorOf(result)).toMatchObject({
    category: "not_found",
    status: 404,
    discord_code: 10003,
    message: "Discord rejected the request (HTTP 404): Unknown Channel",
  });
});

it("succeeds under an allowlist containing the guild with literal routes", async () => {
  const registry = await singleToolRegistry("discord_delete_thread_member");
  const { client, request } = await threadHarness({
    registry,
    policy: new PPolicyEngine(["200"], ["threads"], false),
    makeRequest: async (url) => {
      if (String(url).endsWith("/channels/101")) {
        return json({ id: "101", guild_id: "200" });
      }
      return empty204();
    },
  });
  const result = await client.callTool({
    name: "discord_delete_thread_member",
    arguments: args,
  });
  expect(result.structuredContent).toEqual({ deleted: true, channel_id: "101", user_id: "501" });
  expect([request(0).method, request(0).url]).toEqual([
    "GET",
    "https://discord.com/api/v10/channels/101",
  ]);
  expect([request(1).method, request(1).url]).toEqual([
    "DELETE",
    "https://discord.com/api/v10/channels/101/thread-members/501",
  ]);
});

it("denies channel in a guild outside the allowlist before sending delete", async () => {
  const registry = await singleToolRegistry("discord_delete_thread_member");
  const { client, request, makeRequest } = await threadHarness({
    registry,
    policy: new PPolicyEngine(["200"], ["threads"], false),
    makeRequest: async () => json({ id: "101", guild_id: "300" }),
  });
  const result = await client.callTool({
    name: "discord_delete_thread_member",
    arguments: args,
  });
  expect(errorOf(result)).toMatchObject({
    category: "policy",
    message: "Guild is not allowed",
  });
  expect(makeRequest).toHaveBeenCalledTimes(1);
  expect([request(0).method, request(0).url]).toEqual([
    "GET",
    "https://discord.com/api/v10/channels/101",
  ]);
});
