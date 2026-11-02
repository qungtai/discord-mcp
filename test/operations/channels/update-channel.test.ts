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

const UPDATED_CHANNEL = {
  id: "100",
  type: 0,
  guild_id: "200",
  name: "renamed-channel",
  parent_id: "10",
  position: 3,
  topic: "Updated topic",
};

it("updates channel settings with reason header", async () => {
  const { client, request } = await harness({
    policy: new PPolicyEngine([], ["channels"], false),
    respond: () => UPDATED_CHANNEL,
  });
  const result = await client.callTool({
    name: "discord_update_channel",
    arguments: {
      channel_id: "100",
      name: "renamed-channel",
      position: 3,
      topic: "Updated topic",
      nsfw: true,
      rate_limit_per_user: 10,
      bitrate: 96000,
      user_limit: 5,
      parent_id: "10",
      rtc_region: "brazil",
      video_quality_mode: 2,
      default_auto_archive_duration: 1440,
      archived: false,
      locked: false,
      invitable: true,
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
    position: 3,
    topic: "Updated topic",
    nsfw: true,
    rate_limit_per_user: 10,
    bitrate: 96000,
    user_limit: 5,
    parent_id: "10",
    rtc_region: "brazil",
    video_quality_mode: 2,
    default_auto_archive_duration: 1440,
    archived: false,
    locked: false,
    invitable: true,
  });
  expect(result.structuredContent).toEqual({ channel: UPDATED_CHANNEL });
});

it("passes allowlist check when guild is allowed", async () => {
  const { client, request, makeRequest } = await harness({
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
  // Channel resolution occurs before call is blocked
  expect(makeRequest).toHaveBeenCalledTimes(1);
});

it("blocks execution in read-only mode", async () => {
  const { pipeline, makeRequest } = await harness({
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

it("handles 403 missing permissions error", async () => {
  const { pipeline } = await harness({
    policy: new PPolicyEngine([], ["channels"], false),
    makeRequest: async () => json({ message: "Missing Permissions", code: 50013 }, { status: 403 }),
  });
  expect(
    await pipeline.call("discord_update_channel", {
      channel_id: "100",
      name: "renamed-channel",
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
