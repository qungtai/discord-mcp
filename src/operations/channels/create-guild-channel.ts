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
} from "./schemas.js";

export const createGuildChannel = defineTool({
  name: "discord_create_guild_channel",
  description:
    "Create a new channel in a guild, such as a text (0), voice (2), category (4), announcement (5), stage (13), or forum (15) channel. Permission overwrites combine allow and deny bitfields, with member-specific overwrites taking precedence over role overwrites. Use discord_update_channel to modify settings after creation. Returns the newly created channel.",
  operationIds: ["create_guild_channel"],
  toolset: "channels",
  scope: { guild: "guild_id" },
  permissions: ["ManageChannels", "ManageRoles"],
  effect: "write",
  // permission_overwrites changes channel permissions for roles and members.
  approval: true,
  idempotent: false,
  input: z.object({
    guild_id: snowflake.describe("Snowflake ID of the guild to create the channel in"),
    name: z.string().min(1).max(100).describe("Channel name (1-100 characters)"),
    type: channelTypeEnum
      .optional()
      .describe(
        "Channel type: 0 (Guild text), 2 (Guild voice), 4 (Category), 5 (Announcement), 13 (Stage voice), 14 (Directory), 15 (Forum); defaults to 0",
      ),
    topic: z
      .string()
      .max(4096)
      .nullish()
      .describe("Channel topic (0-1024 characters for text, 0-4096 characters for forum)"),
    bitrate: z
      .number()
      .int()
      .min(8000)
      .nullish()
      .describe("Bitrate in bits per second for voice or stage channels (minimum 8000)"),
    user_limit: z
      .number()
      .int()
      .min(0)
      .max(10000)
      .nullish()
      .describe(
        "Maximum number of users allowed in voice or stage channels (0 for unlimited, up to 10000 for stage)",
      ),
    rate_limit_per_user: rateLimitPerUser
      .nullish()
      .describe("Slowmode delay per user in seconds (0-21600)"),
    position: z
      .number()
      .int()
      .min(0)
      .nullish()
      .describe(
        "Sorting position in the channel list (channels with lower position appear higher)",
      ),
    parent_id: snowflake
      .nullish()
      .describe("Snowflake ID of the parent category channel for this channel"),
    nsfw: z
      .boolean()
      .nullish()
      .describe("Whether the channel is restricted to users aged 18 and older"),
    rtc_region: z
      .string()
      .nullish()
      .describe("Voice region ID for voice channels (e.g. 'us-west'), or null for automatic"),
    video_quality_mode: videoQualityModeEnum
      .nullish()
      .describe("Camera video quality mode: 1 for Auto, 2 for 720p at 60fps"),
    default_auto_archive_duration: autoArchiveDuration
      .nullish()
      .describe("Default thread auto-archive duration in minutes: 60, 1440, 4320, or 10080"),
    permission_overwrites: z
      .array(permissionOverwrite)
      .max(100)
      .nullish()
      .describe(
        "Array of up to 100 permission overwrites configuring allow and deny bitfields for roles or members",
      ),
    available_tags: z
      .array(forumTag)
      .max(20)
      .nullish()
      .describe("Array of up to 20 available tag objects that can be applied to forum posts"),
    default_reaction_emoji: defaultReactionEmoji
      .nullish()
      .describe("Default reaction emoji to add to newly created forum posts"),
    default_thread_rate_limit_per_user: rateLimitPerUser
      .nullish()
      .describe("Default slowmode delay per user in seconds for newly created threads (0-21600)"),
    default_sort_order: threadSortOrderEnum
      .nullish()
      .describe("Default sort order for forum posts: 0 for latest activity, 1 for creation date"),
    default_forum_layout: forumLayoutEnum
      .nullish()
      .describe(
        "Default forum layout view: 0 for not set, 1 for list view, 2 for grid/gallery view",
      ),
    default_tag_setting: threadTagSetting
      .nullish()
      .describe(
        "Tag requirement rule for forum posts: match_all (must have all tags) or match_some",
      ),
    reason: reason.describe("Reason for creating the channel in the guild audit log"),
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
