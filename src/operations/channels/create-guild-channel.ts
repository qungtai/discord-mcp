import { type RESTPostAPIGuildChannelResult, Routes } from "discord-api-types/v10";
import { z } from "zod/v4";
import { defineTool } from "../../core/tool-registry.js";
import { reason, snowflake } from "../schemas.js";
import { channelResult } from "./ch-channels-schemas.js";

export const createGuildChannel = defineTool({
  name: "discord_create_guild_channel",
  description: "Create a new channel in a guild",
  operationIds: ["create_guild_channel"],
  toolset: "channels",
  scope: { guild: "guild_id" },
  permissions: ["ManageChannels"],
  effect: "write",
  idempotent: false,
  input: z.object({
    guild_id: snowflake,
    name: z.string().min(1).max(100),
    type: z.number().int().optional(),
    topic: z.string().max(4096).optional(),
    bitrate: z.number().int().min(8000).optional(),
    user_limit: z.number().int().min(0).max(99).optional(),
    rate_limit_per_user: z.number().int().min(0).max(21600).optional(),
    position: z.number().int().min(0).optional(),
    parent_id: snowflake.optional(),
    nsfw: z.boolean().optional(),
    rtc_region: z.string().nullish(),
    video_quality_mode: z.number().int().optional(),
    default_auto_archive_duration: z.number().int().optional(),
    reason,
  }),
  output: channelResult,
  execute: async ({ guild_id, reason, ...body }, { discord }) => ({
    channel: await discord<RESTPostAPIGuildChannelResult>({
      method: "POST",
      route: Routes.guildChannels(guild_id),
      body,
      reason,
    }),
  }),
});
