import { type RESTPatchAPIGuildChannelPositionsResult, Routes } from "discord-api-types/v10";
import { z } from "zod/v4";
import { defineTool } from "../../core/tool-registry.js";
import { reason, snowflake } from "../schemas.js";

const channelPosition = z.strictObject({
  id: snowflake,
  position: z.number().int().min(0).nullish(),
  parent_id: snowflake.nullish(),
  lock_permissions: z.boolean().nullish(),
});

export const bulkUpdateGuildChannels = defineTool({
  name: "discord_bulk_update_guild_channels",
  description: "Modify the positions of a set of channels for the guild",
  operationIds: ["bulk_update_guild_channels"],
  toolset: "channels",
  scope: { guild: "guild_id" },
  permissions: ["ManageChannels"],
  effect: "destructive",
  idempotent: true,
  input: z.object({
    guild_id: snowflake,
    channels: z.array(channelPosition).min(1),
    reason,
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
