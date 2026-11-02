import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { PPolicyEngine } from "../../../src/core/policy.js";
import { PToolRegistry } from "../../../src/core/tool-registry.js";
import { deleteChannel } from "../../../src/operations/channels/delete-channel.js";
import { errorOf, harness, json } from "../../support/harness.js";

beforeEach(() => {
  vi.spyOn(process.stderr, "write").mockReturnValue(true);
});
afterEach(() => {
  vi.restoreAllMocks();
});

const approvalFreeRegistry = () => {
  const registry = new PToolRegistry();
  registry.register({ ...deleteChannel, approval: false });
  return registry;
};

it("has approval enabled by default and is blocked by policy until approval flow is supported", async () => {
  const { pipeline } = await harness({
    policy: new PPolicyEngine([], ["channels"], false),
  });
  expect(await pipeline.call("discord_delete_channel", { channel_id: "100" })).toMatchObject({
    ok: false,
    error: {
      category: "policy",
      message: "This tool requires approval support",
      remediation: "Wait for the approval flow",
    },
  });
});

it("deletes a channel with audit log reason when approval is satisfied", async () => {
  const { client, request } = await harness({
    registry: approvalFreeRegistry(),
    policy: new PPolicyEngine([], ["channels"], false),
    respond: () => ({ id: "100" }),
  });
  const result = await client.callTool({
    name: "discord_delete_channel",
    arguments: {
      channel_id: "100",
      reason: "Deleting obsolete channel",
    },
  });

  const req = request();
  expect(req.method).toBe("DELETE");
  expect(req.url).toBe("https://discord.com/api/v10/channels/100");
  expect(new Headers(req.headers as HeadersInit).get("x-audit-log-reason")).toBe(
    encodeURIComponent("Deleting obsolete channel"),
  );
  expect(result.structuredContent).toEqual({ deleted: true, channel_id: "100" });
});

it("passes allowlist check when guild is allowed", async () => {
  const { client, request, makeRequest } = await harness({
    registry: approvalFreeRegistry(),
    policy: new PPolicyEngine(["200"], ["channels"], false),
    respond: () => ({ id: "100", guild_id: "200" }),
  });
  const result = await client.callTool({
    name: "discord_delete_channel",
    arguments: {
      channel_id: "100",
    },
  });
  expect(result.structuredContent).toEqual({ deleted: true, channel_id: "100" });
  expect(makeRequest).toHaveBeenCalledTimes(2);
  expect(request(0).method).toBe("GET");
  expect(request(1).method).toBe("DELETE");
});

it("denies access when channel is in an unallowed guild", async () => {
  const { client, makeRequest } = await harness({
    registry: approvalFreeRegistry(),
    policy: new PPolicyEngine(["999"], ["channels"], false),
    respond: () => ({ id: "100", guild_id: "200" }),
  });
  const result = await client.callTool({
    name: "discord_delete_channel",
    arguments: {
      channel_id: "100",
    },
  });
  expect(errorOf(result)).toMatchObject({
    category: "policy",
    message: "Guild is not allowed",
  });
  expect(makeRequest).toHaveBeenCalledTimes(1);
});

it("blocks execution in read-only mode", async () => {
  const { pipeline, makeRequest } = await harness({
    registry: approvalFreeRegistry(),
    policy: new PPolicyEngine([], ["channels"], true),
  });
  const result = await pipeline.call("discord_delete_channel", {
    channel_id: "100",
  });
  expect(result).toMatchObject({
    error: { category: "policy", message: "Read-only mode" },
  });
  expect(makeRequest).not.toHaveBeenCalled();
});

it.each([
  { input: { channel_id: "invalid-snowflake" }, desc: "invalid snowflake" },
  { input: { channel_id: "100", extra: "extra" }, desc: "unknown key" },
])("validates input: $desc", async ({ input }) => {
  const { client, makeRequest } = await harness({
    registry: approvalFreeRegistry(),
    policy: new PPolicyEngine([], ["channels"], false),
  });
  const result = await client.callTool({
    name: "discord_delete_channel",
    arguments: input,
  });
  expect(errorOf(result)).toMatchObject({ category: "validation" });
  expect(makeRequest).not.toHaveBeenCalled();
});

it.each([
  [
    403,
    50013,
    "permission",
    "Check the bot permissions; this tool needs ManageChannels, ManageThreads",
  ],
  [404, 10003, "not_found", "Check the IDs in the request"],
])("handles HTTP %i error", async (status, code, category, remediation) => {
  const { pipeline } = await harness({
    registry: approvalFreeRegistry(),
    policy: new PPolicyEngine([], ["channels"], false),
    makeRequest: async () => json({ message: "Discord error", code }, { status }),
  });
  expect(
    await pipeline.call("discord_delete_channel", {
      channel_id: "100",
    }),
  ).toMatchObject({
    ok: false,
    error: {
      category,
      status,
      discord_code: code,
      remediation,
    },
  });
});
