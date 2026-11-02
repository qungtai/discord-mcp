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

const args = { channel_id: "1", messages: ["10", "11"], reason: "cleanup batch" };
const empty204 = () => new Response(null, { status: 204 }) as unknown as ResponseLike;

it("is gated pending approval support by default", async () => {
  const tool = (await PToolRegistry.load()).get("discord_bulk_delete_messages");
  expect(tool?.effect).toBe("destructive");
  expect(tool?.approval).toBe(true);

  const { client, makeRequest } = await harness();
  const result = await client.callTool({
    name: "discord_bulk_delete_messages",
    arguments: args,
  });
  expect(errorOf(result)).toMatchObject({
    category: "policy",
    message: "This tool requires approval support",
    remediation: "Wait for the approval flow",
  });
  expect(makeRequest).not.toHaveBeenCalled();
});

it("bulk deletes messages with an audit reason when approval is bypassed", async () => {
  const base = (await PToolRegistry.load()).get("discord_bulk_delete_messages");
  if (!base) throw new Error("Missing tool");
  const registry = new PToolRegistry();
  registry.register({ ...base, approval: false });

  const { client, request } = await harness({
    registry,
    makeRequest: async () => empty204(),
  });
  const result = await client.callTool({
    name: "discord_bulk_delete_messages",
    arguments: args,
  });
  const { url, method, body, headers } = request();
  expect([method, url]).toEqual([
    "POST",
    "https://discord.com/api/v10/channels/1/messages/bulk-delete",
  ]);
  expect(new Headers(headers as HeadersInit).get("x-audit-log-reason")).toBe("cleanup%20batch");
  expect(JSON.parse(String(body))).toEqual({ messages: ["10", "11"] });
  expect(result.structuredContent).toEqual({
    deleted: true,
    channel_id: "1",
    count: 2,
  });
});

it("allows access under an allowed guild", async () => {
  const base = (await PToolRegistry.load()).get("discord_bulk_delete_messages");
  if (!base) throw new Error("Missing tool");
  const registry = new PToolRegistry();
  registry.register({ ...base, approval: false });

  const { client } = await harness({
    registry,
    policy: new PPolicyEngine(["100"], ["core", "messages"], false),
    makeRequest: async (url) => {
      if (String(url).endsWith("/channels/1")) return json({ id: "1", guild_id: "100" });
      return empty204();
    },
  });
  const result = await client.callTool({
    name: "discord_bulk_delete_messages",
    arguments: { channel_id: "1", messages: ["10", "11"] },
  });
  expect(result.structuredContent).toEqual({
    deleted: true,
    channel_id: "1",
    count: 2,
  });
});

it("blocks access when channel belongs to a disallowed guild", async () => {
  const base = (await PToolRegistry.load()).get("discord_bulk_delete_messages");
  if (!base) throw new Error("Missing tool");
  const registry = new PToolRegistry();
  registry.register({ ...base, approval: false });

  const { client, makeRequest } = await harness({
    registry,
    policy: new PPolicyEngine(["100"], ["core", "messages"], false),
    respond: () => ({ id: "1", guild_id: "200" }),
  });
  const result = await client.callTool({
    name: "discord_bulk_delete_messages",
    arguments: { channel_id: "1", messages: ["10", "11"] },
  });
  expect(errorOf(result)).toMatchObject({ category: "policy", message: "Guild is not allowed" });
  expect(makeRequest).toHaveBeenCalledTimes(1);
});

it("fails validation if fewer than 2 messages are provided", async () => {
  const base = (await PToolRegistry.load()).get("discord_bulk_delete_messages");
  if (!base) throw new Error("Missing tool");
  const registry = new PToolRegistry();
  registry.register({ ...base, approval: false });

  const { client, makeRequest } = await harness({ registry });
  const result = await client.callTool({
    name: "discord_bulk_delete_messages",
    arguments: { channel_id: "1", messages: ["10"] },
  });
  expect(errorOf(result)).toMatchObject({ category: "validation" });
  expect(makeRequest).not.toHaveBeenCalled();
});

it("maps a 403 to permission error", async () => {
  const base = (await PToolRegistry.load()).get("discord_bulk_delete_messages");
  if (!base) throw new Error("Missing tool");
  const registry = new PToolRegistry();
  registry.register({ ...base, approval: false });

  const { pipeline } = await harness({
    registry,
    makeRequest: async () => json({ message: "Missing Permissions", code: 50013 }, { status: 403 }),
  });
  expect(
    await pipeline.call("discord_bulk_delete_messages", {
      channel_id: "1",
      messages: ["10", "11"],
    }),
  ).toMatchObject({
    ok: false,
    error: {
      category: "permission",
      retryable: false,
      status: 403,
      discord_code: 50013,
      remediation: "Check the bot permissions; this tool needs ViewChannel, ManageMessages",
    },
  });
});
