import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { PPolicyEngine } from "../../../src/core/policy.js";
import { errorOf, harness, json } from "../../support/harness.js";

beforeEach(() => {
  vi.spyOn(process.stderr, "write").mockReturnValue(true);
});
afterEach(() => {
  vi.restoreAllMocks();
});

const CREATED_CHANNEL = {
  id: "105",
  type: 0,
  guild_id: "200",
  name: "new-channel",
  parent_id: "10",
  position: 2,
  topic: "New topic",
};

it("creates a guild channel with all parameters and audit log reason", async () => {
  const { client, request } = await harness({
    policy: new PPolicyEngine([], ["channels"], false),
    respond: () => CREATED_CHANNEL,
  });
  const result = await client.callTool({
    name: "discord_create_guild_channel",
    arguments: {
      guild_id: "200",
      name: "new-channel",
      type: 0,
      topic: "New topic",
      bitrate: 64000,
      user_limit: 500,
      rate_limit_per_user: 5,
      position: 2,
      parent_id: "10",
      nsfw: false,
      rtc_region: "us-west",
      video_quality_mode: 1,
      default_auto_archive_duration: 60,
      permission_overwrites: [{ id: "300", type: 0, allow: "1024", deny: "2048" }],
      available_tags: [{ name: "bug", moderated: true, emoji_name: "beetle" }],
      default_reaction_emoji: { emoji_name: "thumbsup" },
      default_thread_rate_limit_per_user: 10,
      default_sort_order: 1,
      default_forum_layout: 2,
      default_tag_setting: "match_all",
      reason: "Creating test channel",
    },
  });

  const req = request();
  expect(req.method).toBe("POST");
  expect(req.url).toBe("https://discord.com/api/v10/guilds/200/channels");
  expect(new Headers(req.headers as HeadersInit).get("x-audit-log-reason")).toBe(
    encodeURIComponent("Creating test channel"),
  );
  expect(JSON.parse(String(req.body))).toEqual({
    name: "new-channel",
    type: 0,
    topic: "New topic",
    bitrate: 64000,
    user_limit: 500,
    rate_limit_per_user: 5,
    position: 2,
    parent_id: "10",
    nsfw: false,
    rtc_region: "us-west",
    video_quality_mode: 1,
    default_auto_archive_duration: 60,
    permission_overwrites: [{ id: "300", type: 0, allow: "1024", deny: "2048" }],
    available_tags: [{ name: "bug", moderated: true, emoji_name: "beetle" }],
    default_reaction_emoji: { emoji_name: "thumbsup" },
    default_thread_rate_limit_per_user: 10,
    default_sort_order: 1,
    default_forum_layout: 2,
    default_tag_setting: "match_all",
  });
  expect(result.structuredContent).toEqual({ channel: CREATED_CHANNEL });
});

it("passes allowlist check when guild is allowed", async () => {
  const { client, request } = await harness({
    policy: new PPolicyEngine(["200"], ["channels"], false),
    respond: () => CREATED_CHANNEL,
  });
  const result = await client.callTool({
    name: "discord_create_guild_channel",
    arguments: {
      guild_id: "200",
      name: "new-channel",
    },
  });
  expect(result.structuredContent).toEqual({ channel: CREATED_CHANNEL });
  expect(request().method).toBe("POST");
});

it("denies access when guild is not allowed", async () => {
  const { client, makeRequest } = await harness({
    policy: new PPolicyEngine(["999"], ["channels"], false),
  });
  const result = await client.callTool({
    name: "discord_create_guild_channel",
    arguments: {
      guild_id: "200",
      name: "new-channel",
    },
  });
  expect(errorOf(result)).toMatchObject({
    category: "policy",
    message: "Guild is not allowed",
  });
  expect(makeRequest).not.toHaveBeenCalled();
});

it("blocks execution in read-only mode", async () => {
  const { pipeline, makeRequest } = await harness({
    policy: new PPolicyEngine([], ["channels"], true),
  });
  const result = await pipeline.call("discord_create_guild_channel", {
    guild_id: "200",
    name: "new-channel",
  });
  expect(result).toMatchObject({
    error: { category: "policy", message: "Read-only mode" },
  });
  expect(makeRequest).not.toHaveBeenCalled();
});

it.each([
  { input: { guild_id: "200", name: "" }, desc: "empty name" },
  { input: { guild_id: "200", name: "a".repeat(101) }, desc: "name too long" },
  { input: { guild_id: "200", name: "x", bitrate: 7999 }, desc: "bitrate below min" },
  { input: { guild_id: "200", name: "x", user_limit: -1 }, desc: "user_limit below min" },
  { input: { guild_id: "200", name: "x", user_limit: 10001 }, desc: "user_limit above max" },
  { input: { guild_id: "200", name: "x", rate_limit_per_user: 21601 }, desc: "slowmode above max" },
  { input: { guild_id: "200", name: "x", position: -1 }, desc: "position below min" },
  { input: { guild_id: "200", name: "x", type: 99 }, desc: "invalid channel type" },
  {
    input: { guild_id: "200", name: "x", video_quality_mode: 3 },
    desc: "invalid video quality mode",
  },
  {
    input: { guild_id: "200", name: "x", default_auto_archive_duration: 120 },
    desc: "invalid auto archive duration",
  },
  { input: { guild_id: "200", name: "x", extra: "dropped" }, desc: "unknown key" },
])("validates input: $desc", async ({ input }) => {
  const { client, makeRequest } = await harness({
    policy: new PPolicyEngine([], ["channels"], false),
  });
  const result = await client.callTool({
    name: "discord_create_guild_channel",
    arguments: input,
  });
  expect(errorOf(result)).toMatchObject({ category: "validation" });
  expect(makeRequest).not.toHaveBeenCalled();
});

it.each([
  [403, 50013, "permission", "Check the bot permissions; this tool needs ManageChannels"],
  [404, 10004, "not_found", "Check the IDs in the request"],
])("handles HTTP %i error", async (status, code, category, remediation) => {
  const { pipeline } = await harness({
    policy: new PPolicyEngine([], ["channels"], false),
    makeRequest: async () => json({ message: "Discord error", code }, { status }),
  });
  expect(
    await pipeline.call("discord_create_guild_channel", {
      guild_id: "200",
      name: "new-channel",
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
