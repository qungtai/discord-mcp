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

const args = { channel_id: "101", user_id: "501" };
const empty204 = () => new Response(null, { status: 204 }) as unknown as ResponseLike;

it("is gated pending approval support by default", async () => {
  const tool = (await PToolRegistry.load()).get("discord_delete_thread_member");
  expect(tool?.effect).toBe("destructive");
  expect(tool?.approval).toBe(true);

  const { client, makeRequest } = await harness({
    policy: new PPolicyEngine([], ["threads"], false),
  });
  const result = await client.callTool({
    name: "discord_delete_thread_member",
    arguments: args,
  });
  expect(errorOf(result)).toMatchObject({
    category: "policy",
    message: "This tool requires approval support",
    remediation: "Wait for the approval flow",
  });
  expect(makeRequest).not.toHaveBeenCalled();
});

it("deletes a thread member and returns deleted status when approval is bypassed", async () => {
  const base = (await PToolRegistry.load()).get("discord_delete_thread_member");
  if (!base) throw new Error("Missing tool");
  const registry = new PToolRegistry();
  registry.register({ ...base, approval: false });

  const { client, request } = await harness({
    registry,
    policy: new PPolicyEngine([], ["threads"], false),
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
  const { client, makeRequest } = await harness({
    policy: new PPolicyEngine([], ["threads"], false),
  });
  const result = await client.callTool({
    name: "discord_delete_thread_member",
    arguments: { channel_id: "not-snowflake", user_id: "501" },
  });
  expect(errorOf(result)).toMatchObject({ category: "validation" });
  expect(makeRequest).not.toHaveBeenCalled();
});

it("handles 403 error", async () => {
  const base = (await PToolRegistry.load()).get("discord_delete_thread_member");
  if (!base) throw new Error("Missing tool");
  const registry = new PToolRegistry();
  registry.register({ ...base, approval: false });

  const { pipeline } = await harness({
    registry,
    policy: new PPolicyEngine([], ["threads"], false),
    makeRequest: async () => json({ message: "Missing Permissions", code: 50013 }, { status: 403 }),
  });
  const result = await pipeline.call("discord_delete_thread_member", args);
  expect(result).toMatchObject({
    ok: false,
    error: { category: "permission", status: 403, discord_code: 50013 },
  });
});

it("handles 404 error", async () => {
  const base = (await PToolRegistry.load()).get("discord_delete_thread_member");
  if (!base) throw new Error("Missing tool");
  const registry = new PToolRegistry();
  registry.register({ ...base, approval: false });

  const { pipeline } = await harness({
    registry,
    policy: new PPolicyEngine([], ["threads"], false),
    makeRequest: async () => json({ message: "Unknown Channel", code: 10003 }, { status: 404 }),
  });
  const result = await pipeline.call("discord_delete_thread_member", {
    channel_id: "999",
    user_id: "501",
  });
  expect(result).toMatchObject({
    ok: false,
    error: { category: "not_found", status: 404 },
  });
});

it("succeeds under an allowlist containing the guild", async () => {
  const base = (await PToolRegistry.load()).get("discord_delete_thread_member");
  if (!base) throw new Error("Missing tool");
  const registry = new PToolRegistry();
  registry.register({ ...base, approval: false });

  const { client, request } = await harness({
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
  expect(request(1).method).toBe("DELETE");
});

it("denies channel in a guild outside the allowlist before sending delete", async () => {
  const base = (await PToolRegistry.load()).get("discord_delete_thread_member");
  if (!base) throw new Error("Missing tool");
  const registry = new PToolRegistry();
  registry.register({ ...base, approval: false });

  const { client, makeRequest } = await harness({
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
});
