import { type RESTPostAPIChannelFollowersResult, Routes } from "discord-api-types/v10";
import { z } from "zod/v4";
import { defineTool } from "../../core/tool-registry.js";
import { reason, snowflake } from "../schemas.js";

export const followChannel = defineTool({
  name: "discord_follow_channel",
  description:
    "Follow an announcement (type 5) channel to automatically crosspost messages into a target channel in another guild or the same guild. Creates a follower webhook in the target channel. Use discord_crosspost_message to publish a message from an announcement channel. Returns the source channel ID and created follower webhook ID.",
  operationIds: ["follow_channel"],
  toolset: "channels",
  scope: { channel: ["channel_id", "webhook_channel_id"] },
  permissions: ["ManageWebhooks"],
  effect: "write",
  idempotent: false,
  input: z.object({
    channel_id: snowflake.describe("Snowflake ID of the announcement channel (type 5) to follow"),
    webhook_channel_id: snowflake.describe(
      "Snowflake ID of the target channel where crossposted messages should be received",
    ),
    reason: reason.describe("Reason for following the announcement channel in the audit log"),
  }),
  output: z.object({
    channel_id: snowflake,
    webhook_id: snowflake,
  }),
  execute: async ({ channel_id, reason, ...body }, { discord }) =>
    discord<RESTPostAPIChannelFollowersResult>({
      method: "POST",
      route: Routes.channelFollowers(channel_id),
      body,
      reason,
    }),
});
