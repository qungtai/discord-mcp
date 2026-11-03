import { type RESTPatchAPIChannelResult, Routes } from "discord-api-types/v10";
import { z } from "zod/v4";
import { defineTool } from "../../core/tool-registry.js";
import {
  autoArchiveDuration,
  rateLimitPerUser,
  reason,
  snowflake,
  threadTagSetting,
} from "../schemas.js";
import {
  channelResult,
  channelTypeEnum,
  defaultReactionEmoji,
  forumLayoutEnum,
  forumTag,
  permissionOverwrite,
  threadSortOrderEnum,
  videoQualityModeEnum,
} from "./schemas.js";

export const updateChannel = defineTool({
  name: "discord_update_channel",
  description: "Update a channel's settings",
  operationIds: ["update_channel"],
  toolset: "channels",
  scope: { channel: "channel_id" },
  // ManageChannels is required for channels; ManageThreads for threads; ManageRoles when editing permission_overwrites.
  permissions: ["ManageChannels", "ManageThreads", "ManageRoles"],
  effect: "destructive",
  idempotent: true,
  input: z.object({
    channel_id: snowflake,
    name: z.string().min(1).max(100).optional(),
    type: channelTypeEnum.optional(),
    position: z.number().int().min(0).nullish(),
    topic: z.string().max(4096).nullish(),
    nsfw: z.boolean().nullish(),
    rate_limit_per_user: rateLimitPerUser.nullish(),
    bitrate: z.number().int().min(8000).nullish(),
    user_limit: z.number().int().min(0).max(10000).nullish(),
    parent_id: snowflake.nullish(),
    rtc_region: z.string().nullish(),
    video_quality_mode: videoQualityModeEnum.nullish(),
    default_auto_archive_duration: autoArchiveDuration.nullish(),
    permission_overwrites: z.array(permissionOverwrite).max(100).nullish(),
    available_tags: z.array(forumTag).max(20).nullish(),
    default_reaction_emoji: defaultReactionEmoji.nullish(),
    default_thread_rate_limit_per_user: rateLimitPerUser.nullish(),
    default_sort_order: threadSortOrderEnum.nullish(),
    default_forum_layout: forumLayoutEnum.nullish(),
    default_tag_setting: threadTagSetting.nullish(),
    flags: z.number().int().optional(),
    archived: z.boolean().optional(),
    locked: z.boolean().optional(),
    invitable: z.boolean().optional(),
    auto_archive_duration: autoArchiveDuration.optional(),
    applied_tags: z.array(snowflake).max(5).optional(),
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
