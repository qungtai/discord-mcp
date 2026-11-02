import { type RESTPostAPIGuildChannelResult, Routes } from "discord-api-types/v10";
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
} from "./ch-channels-schemas.js";

export const createGuildChannel = defineTool({
  name: "discord_create_guild_channel",
  description: "Create a new channel in a guild",
  operationIds: ["create_guild_channel"],
  toolset: "channels",
  scope: { guild: "guild_id" },
  permissions: ["ManageChannels", "ManageRoles"],
  effect: "write",
  // permission_overwrites changes channel permissions for roles and members.
  approval: true,
  idempotent: false,
  input: z.object({
    guild_id: snowflake,
    name: z.string().min(1).max(100),
    type: channelTypeEnum.optional(),
    topic: z.string().max(4096).nullish(),
    bitrate: z.number().int().min(8000).nullish(),
    user_limit: z.number().int().min(0).max(10000).nullish(),
    rate_limit_per_user: rateLimitPerUser.nullish(),
    position: z.number().int().min(0).nullish(),
    parent_id: snowflake.nullish(),
    nsfw: z.boolean().nullish(),
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
