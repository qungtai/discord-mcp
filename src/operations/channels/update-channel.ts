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
  description:
    "Update settings for a guild channel, voice channel, category or thread. Permission overwrites combine allow and deny bitfields, where member overwrites take precedence over role overwrites. Use discord_bulk_update_guild_channels to reorder multiple channels at once. Returns the updated channel object.",
  operationIds: ["update_channel"],
  toolset: "channels",
  scope: { channel: "channel_id" },
  // ManageChannels is required for channels; ManageThreads for threads; ManageRoles when editing permission_overwrites.
  permissions: ["ManageChannels", "ManageThreads", "ManageRoles"],
  effect: "destructive",
  idempotent: true,
  input: z.object({
    channel_id: snowflake.describe("Snowflake ID of the channel or thread to update"),
    name: z.string().min(1).max(100).optional().describe("Channel name (1-100 characters)"),
    type: channelTypeEnum
      .optional()
      .describe(
        "Channel type (conversion only supported between text 0 and announcement 5 in guilds with Announcement feature)",
      ),
    position: z
      .number()
      .int()
      .min(0)
      .nullish()
      .describe("Sorting position of the channel in the channel list"),
    topic: z
      .string()
      .max(4096)
      .nullish()
      .describe("Channel topic (0-1024 characters for text, 0-4096 characters for forum)"),
    nsfw: z
      .boolean()
      .nullish()
      .describe("Whether the channel is restricted to users aged 18 and older"),
    rate_limit_per_user: rateLimitPerUser
      .nullish()
      .describe("Slowmode delay per user in seconds (0-21600)"),
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
    parent_id: snowflake
      .nullish()
      .describe("Snowflake ID of the parent category channel for this channel"),
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
    flags: z
      .number()
      .int()
      .optional()
      .describe("Channel flags bitfield (e.g. REQUIRE_TAG 16 for forum/media channels)"),
    archived: z.boolean().optional().describe("Whether the thread is archived"),
    locked: z
      .boolean()
      .optional()
      .describe(
        "Whether the thread is locked (only users with ManageThreads can unarchive or talk)",
      ),
    invitable: z
      .boolean()
      .optional()
      .describe("Whether non-moderators can invite other members to this private thread"),
    auto_archive_duration: autoArchiveDuration
      .optional()
      .describe(
        "Duration in minutes to automatically archive the thread after inactivity: 60, 1440, 4320, or 10080",
      ),
    applied_tags: z
      .array(snowflake)
      .max(5)
      .optional()
      .describe("Array of up to 5 tag snowflake IDs applied to a forum post"),
    reason: reason.describe("Reason for updating the channel in the guild audit log"),
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
