import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { PPolicyEngine } from "../../../src/core/policy.js";
import { PToolRegistry } from "../../../src/core/tool-registry.js";
import { updateChannel } from "../../../src/operations/channels/update-channel.js";
import { errorOf, harness, json } from "../../support/harness.js";

beforeEach(() => {
  vi.spyOn(process.stderr, "write").mockReturnValue(true);
});
afterEach(() => {
  vi.restoreAllMocks();
});

const UPDATED_CHANNEL = {
  id: "100",
  type: 0,
  guild_id: "200",
  name: "renamed-channel",
  parent_id: "10",
  position: 3,
  topic: "Updated topic",
};

const approvalFreeRegistry = () => {
  const registry = new PToolRegistry();
  registry.register({ ...updateChannel, approval: false });
  return registry;
};

it("has approval enabled by default and is blocked by policy until approval flow is supported", async () => {
  const { pipeline } = await harness({
    policy: new PPolicyEngine([], ["channels"], false),
  });
  expect(
    await pipeline.call("discord_update_channel", {
      channel_id: "100",
      name: "renamed-channel",
    }),
  ).toMatchObject({
    ok: false,
    error: {
      category: "policy",
      message: "This tool requires approval support",
      remediation: "Wait for the approval flow",
    },
  });
});

it("updates channel settings with reason header when approval is satisfied", async () => {
  const { client, request } = await harness({
    registry: approvalFreeRegistry(),
    policy: new PPolicyEngine([], ["channels"], false),
    respond: () => UPDATED_CHANNEL,
  });
  const result = await client.callTool({
    name: "discord_update_channel",
    arguments: {
      channel_id: "100",
      name: "renamed-channel",
      type: 0,
      position: 3,
      topic: "Updated topic",
      nsfw: true,
      rate_limit_per_user: 10,
      bitrate: 96000,
      user_limit: 500,
      parent_id: "10",
      rtc_region: "brazil",
      video_quality_mode: 2,
      default_auto_archive_duration: 1440,
      permission_overwrites: [{ id: "300", type: 1, allow: 1024 }],
      available_tags: [{ id: "400", name: "fixed", emoji_name: "check" }],
      default_reaction_emoji: { emoji_id: "500" },
      default_thread_rate_limit_per_user: 5,
      default_sort_order: 0,
      default_forum_layout: 1,
      default_tag_setting: "match_some",
      flags: 2,
      archived: false,
      locked: false,
      invitable: true,
      auto_archive_duration: 60,
      applied_tags: ["400"],
      reason: "Updating channel settings",
    },
  });

  const req = request();
  expect(req.method).toBe("PATCH");
  expect(req.url).toBe("https://discord.com/api/v10/channels/100");
  expect(new Headers(req.headers as HeadersInit).get("x-audit-log-reason")).toBe(
    encodeURIComponent("Updating channel settings"),
  );
  expect(JSON.parse(String(req.body))).toEqual({
    name: "renamed-channel",
    type: 0,
    position: 3,
    topic: "Updated topic",
    nsfw: true,
    rate_limit_per_user: 10,
    bitrate: 96000,
    user_limit: 500,
    parent_id: "10",
    rtc_region: "brazil",
    video_quality_mode: 2,
    default_auto_archive_duration: 1440,
    permission_overwrites: [{ id: "300", type: 1, allow: 1024 }],
    available_tags: [{ id: "400", name: "fixed", emoji_name: "check" }],
    default_reaction_emoji: { emoji_id: "500" },
    default_thread_rate_limit_per_user: 5,
    default_sort_order: 0,
    default_forum_layout: 1,
    default_tag_setting: "match_some",
    flags: 2,
    archived: false,
    locked: false,
    invitable: true,
    auto_archive_duration: 60,
    applied_tags: ["400"],
  });
  expect(result.structuredContent).toEqual({ channel: UPDATED_CHANNEL });
});

it("passes allowlist check when guild is allowed", async () => {
  const { client, request, makeRequest } = await harness({
    registry: approvalFreeRegistry(),
    policy: new PPolicyEngine(["200"], ["channels"], false),
    respond: () => UPDATED_CHANNEL,
  });
  const result = await client.callTool({
    name: "discord_update_channel",
    arguments: {
      channel_id: "100",
      name: "renamed-channel",
    },
  });
  expect(result.structuredContent).toEqual({ channel: UPDATED_CHANNEL });
  expect(makeRequest).toHaveBeenCalledTimes(2);
  expect(request(0).method).toBe("GET");
  expect(request(1).method).toBe("PATCH");
});

it("denies access when channel is in an unallowed guild", async () => {
  const { client, makeRequest } = await harness({
    registry: approvalFreeRegistry(),
    policy: new PPolicyEngine(["999"], ["channels"], false),
    respond: () => UPDATED_CHANNEL,
  });
  const result = await client.callTool({
    name: "discord_update_channel",
    arguments: {
      channel_id: "100",
      name: "renamed-channel",
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
  const result = await pipeline.call("discord_update_channel", {
    channel_id: "100",
    name: "renamed-channel",
  });
  expect(result).toMatchObject({
    error: { category: "policy", message: "Read-only mode" },
  });
  expect(makeRequest).not.toHaveBeenCalled();
});

it.each([
  { input: { channel_id: "100", name: "" }, desc: "empty name" },
  { input: { channel_id: "100", name: "a".repeat(101) }, desc: "name too long" },
  { input: { channel_id: "100", bitrate: 7999 }, desc: "bitrate below min" },
  { input: { channel_id: "100", user_limit: -1 }, desc: "user_limit below min" },
  { input: { channel_id: "100", user_limit: 10001 }, desc: "user_limit above max" },
  { input: { channel_id: "100", rate_limit_per_user: 21601 }, desc: "slowmode above max" },
  { input: { channel_id: "100", position: -1 }, desc: "position below min" },
  { input: { channel_id: "100", type: 99 }, desc: "invalid channel type" },
  { input: { channel_id: "100", video_quality_mode: 3 }, desc: "invalid video quality mode" },
  {
    input: { channel_id: "100", default_auto_archive_duration: 120 },
    desc: "invalid auto archive duration",
  },
  {
    input: { channel_id: "100", auto_archive_duration: 120 },
    desc: "invalid thread auto archive duration",
  },
  { input: { channel_id: "100", extra: "dropped" }, desc: "unknown key" },
])("validates input: $desc", async ({ input }) => {
  const { client, makeRequest } = await harness({
    registry: approvalFreeRegistry(),
    policy: new PPolicyEngine([], ["channels"], false),
  });
  const result = await client.callTool({
    name: "discord_update_channel",
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
    await pipeline.call("discord_update_channel", {
      channel_id: "100",
      name: "renamed-channel",
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
