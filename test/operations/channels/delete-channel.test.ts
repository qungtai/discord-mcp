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
  vi.unstubAllGlobals();
});

const DELETED_CHANNEL = {
  id: "100",
  type: 0,
  guild_id: "200",
  name: "deleted-channel",
  parent_id: null,
  position: 0,
  topic: null,
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
  const registry = new PToolRegistry();
  registry.register({ ...deleteChannel, approval: false });
  const { client, request } = await harness({
    registry,
    policy: new PPolicyEngine([], ["channels"], false),
    respond: () => DELETED_CHANNEL,
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
  expect(result.structuredContent).toEqual({ channel: DELETED_CHANNEL });
});

it("passes allowlist check when guild is allowed", async () => {
  const registry = new PToolRegistry();
  registry.register({ ...deleteChannel, approval: false });
  const { client, request, makeRequest } = await harness({
    registry,
    policy: new PPolicyEngine(["200"], ["channels"], false),
    respond: () => DELETED_CHANNEL,
  });
  const result = await client.callTool({
    name: "discord_delete_channel",
    arguments: {
      channel_id: "100",
    },
  });
  expect(result.structuredContent).toEqual({ channel: DELETED_CHANNEL });
  expect(makeRequest).toHaveBeenCalledTimes(2);
  expect(request(0).method).toBe("GET");
  expect(request(1).method).toBe("DELETE");
});

it("denies access when channel is in an unallowed guild", async () => {
  const registry = new PToolRegistry();
  registry.register({ ...deleteChannel, approval: false });
  const { client, makeRequest } = await harness({
    registry,
    policy: new PPolicyEngine(["999"], ["channels"], false),
    respond: () => DELETED_CHANNEL,
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
  const registry = new PToolRegistry();
  registry.register({ ...deleteChannel, approval: false });
  const { pipeline, makeRequest } = await harness({
    registry,
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

it("handles 403 missing permissions error", async () => {
  const registry = new PToolRegistry();
  registry.register({ ...deleteChannel, approval: false });
  const { pipeline } = await harness({
    registry,
    policy: new PPolicyEngine([], ["channels"], false),
    makeRequest: async () => json({ message: "Missing Permissions", code: 50013 }, { status: 403 }),
  });
  expect(
    await pipeline.call("discord_delete_channel", {
      channel_id: "100",
    }),
  ).toMatchObject({
    ok: false,
    error: {
      category: "permission",
      status: 403,
      discord_code: 50013,
      remediation: "Check the bot permissions; this tool needs ManageChannels",
    },
  });
});
