import { type RESTPostAPIChannelFollowersResult, Routes } from "discord-api-types/v10";
import { z } from "zod/v4";
import { defineTool } from "../../core/tool-registry.js";
import { snowflake } from "../schemas.js";

export const followChannel = defineTool({
  name: "discord_follow_channel",
  description: "Follow an announcement channel to send messages to a target channel",
  operationIds: ["follow_channel"],
  toolset: "channels",
  scope: { channel: ["channel_id", "webhook_channel_id"] },
  permissions: ["ManageWebhooks"],
  effect: "write",
  idempotent: false,
  input: z.object({
    channel_id: snowflake,
    webhook_channel_id: snowflake,
  }),
  output: z.object({
    channel_id: snowflake,
    webhook_id: snowflake,
  }),
  execute: async ({ channel_id, webhook_channel_id }, { discord }) => {
    const follower = await discord<RESTPostAPIChannelFollowersResult>({
      method: "POST",
      route: Routes.channelFollowers(channel_id),
      body: { webhook_channel_id },
    });
    return {
      channel_id: follower.channel_id,
      webhook_id: follower.webhook_id,
    };
  },
});
