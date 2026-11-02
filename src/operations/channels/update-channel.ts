import { type RESTPatchAPIChannelResult, Routes } from "discord-api-types/v10";
import { z } from "zod/v4";
import { defineTool } from "../../core/tool-registry.js";
import { reason, snowflake } from "../schemas.js";
import { channelResult } from "./ch-channels-schemas.js";

export const updateChannel = defineTool({
  name: "discord_update_channel",
  description: "Update a channel's settings",
  operationIds: ["update_channel"],
  toolset: "channels",
  scope: { channel: "channel_id" },
  permissions: ["ManageChannels"],
  effect: "destructive",
  // Renaming or updating channel settings is safe without human-in-the-loop approval.
  approval: false,
  idempotent: true,
  input: z.object({
    channel_id: snowflake,
    name: z.string().min(1).max(100).optional(),
    type: z.number().int().optional(),
    position: z.number().int().min(0).nullish(),
    topic: z.string().max(4096).nullish(),
    nsfw: z.boolean().nullish(),
    rate_limit_per_user: z.number().int().min(0).max(21600).nullish(),
    bitrate: z.number().int().min(8000).nullish(),
    user_limit: z.number().int().min(0).max(99).nullish(),
    parent_id: snowflake.nullish(),
    rtc_region: z.string().nullish(),
    video_quality_mode: z.number().int().nullish(),
    default_auto_archive_duration: z.number().int().nullish(),
    flags: z.number().int().optional(),
    archived: z.boolean().optional(),
    locked: z.boolean().optional(),
    invitable: z.boolean().optional(),
    reason,
  }),
  output: channelResult,
  execute: async ({ channel_id, reason, ...body }, { discord }) => ({
    channel: await discord<RESTPatchAPIChannelResult>({
      method: "PATCH",
      route: Routes.channel(channel_id),
      body,
      reason,
    }),
  }),
});
