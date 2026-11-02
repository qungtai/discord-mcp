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
      user_limit: 10,
      rate_limit_per_user: 5,
      position: 2,
      parent_id: "10",
      nsfw: false,
      rtc_region: "us-west",
      video_quality_mode: 1,
      default_auto_archive_duration: 60,
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
    user_limit: 10,
    rate_limit_per_user: 5,
    position: 2,
    parent_id: "10",
    nsfw: false,
    rtc_region: "us-west",
    video_quality_mode: 1,
    default_auto_archive_duration: 60,
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

it("validates input fields strictly", async () => {
  const { client, makeRequest } = await harness({
    policy: new PPolicyEngine([], ["channels"], false),
  });
  const result = await client.callTool({
    name: "discord_create_guild_channel",
    arguments: {
      guild_id: "200",
      name: "", // min length 1
    },
  });
  expect(errorOf(result)).toMatchObject({ category: "validation" });
  expect(makeRequest).not.toHaveBeenCalled();
});

it("handles 403 missing permissions error", async () => {
  const { pipeline } = await harness({
    policy: new PPolicyEngine([], ["channels"], false),
    makeRequest: async () => json({ message: "Missing Permissions", code: 50013 }, { status: 403 }),
  });
  expect(
    await pipeline.call("discord_create_guild_channel", {
      guild_id: "200",
      name: "new-channel",
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
