import { type RESTPatchAPIGuildChannelPositionsResult, Routes } from "discord-api-types/v10";
import { z } from "zod/v4";
import { defineTool } from "../../core/tool-registry.js";
import { reason, snowflake } from "../schemas.js";

const channelPosition = z.strictObject({
  id: snowflake.describe("Snowflake ID of the channel to reposition"),
  position: z
    .number()
    .int()
    .min(0)
    .nullish()
    .describe("Sorting position of the channel (lower numbers appear higher)"),
  parent_id: snowflake
    .nullish()
    .describe("Snowflake ID of the parent category channel to move this channel into or under"),
  lock_permissions: z
    .boolean()
    .nullish()
    .describe(
      "Whether to sync permission overwrites with the parent category when parent_id is modified",
    ),
});

export const bulkUpdateGuildChannels = defineTool({
  name: "discord_bulk_update_guild_channels",
  description:
    "Modify the sorting positions and parent categories for a set of channels in a guild. Can sync channel permissions with parent categories via lock_permissions. Use discord_update_channel to change single-channel properties such as topic, name or bitrate. Returns the updated guild ID and list of affected channel IDs.",
  operationIds: ["bulk_update_guild_channels"],
  toolset: "channels",
  scope: { guild: "guild_id" },
  permissions: ["ManageChannels"],
  effect: "destructive",
  idempotent: true,
  input: z.object({
    guild_id: snowflake.describe("Snowflake ID of the guild whose channel positions to modify"),
    channels: z
      .array(channelPosition)
      .min(1)
      .describe("List of channel position objects containing id and target sorting position"),
    reason: reason.describe("Reason for repositioning channels in the guild audit log"),
  }),
  output: z.object({
    updated: z.literal(true),
    guild_id: snowflake,
    channel_ids: z.array(snowflake),
  }),
  execute: async ({ guild_id, channels, reason }, { discord }) => {
    await discord<RESTPatchAPIGuildChannelPositionsResult>({
      method: "PATCH",
      route: Routes.guildChannels(guild_id),
      body: channels,
      reason,
    });
    return {
      updated: true as const,
      guild_id,
      channel_ids: channels.map((c) => c.id),
    };
  },
});
