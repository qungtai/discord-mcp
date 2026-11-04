import { type RESTPatchAPIGuildResult, Routes } from "discord-api-types/v10";
import { z } from "zod/v4";
import { defineTool } from "../../core/tool-registry.js";
import { reason, snowflake } from "../schemas.js";
import { guild, guildIds } from "./schemas.js";

export const updateGuild = defineTool({
  name: "discord_update_guild",
  description:
    "Change settings of a guild: name, icon and banner images, verification and notification levels, AFK and system channels, rules and updates channels, locale, description and feature list. Only fields you send change. rules_channel_id and public_updates_channel_id apply to Community servers, and each image needs its guild feature (see the field). To read current values first use discord_get_guild. Returns the updated guild object.",
  operationIds: ["update_guild"],
  toolset: "guild",
  scope: {
    guild: "guild_id",
    channel: [
      "afk_channel_id",
      "system_channel_id",
      "rules_channel_id",
      "public_updates_channel_id",
      "safety_alerts_channel_id",
    ],
  },
  permissions: ["ManageGuild"],
  effect: "destructive",
  idempotent: true,
  input: z.object({
    ...guildIds,
    name: z.string().min(2).max(100).optional().describe("Guild name (2-100 characters)"),
    region: z
      .string()
      .nullish()
      .describe("Voice region ID for the guild, or null to allow automatic selection"),
    verification_level: z
      .number()
      .int()
      .nullish()
      .describe("Verification level: 0 (NONE), 1 (LOW), 2 (MEDIUM), 3 (HIGH), or 4 (VERY_HIGH)"),
    default_message_notifications: z
      .number()
      .int()
      .nullish()
      .describe("Default notification level: 0 for ALL_MESSAGES or 1 for ONLY_MENTIONS"),
    explicit_content_filter: z
      .number()
      .int()
      .nullish()
      .describe(
        "Explicit content filter level: 0 (DISABLED), 1 (MEMBERS_WITHOUT_ROLES), or 2 (ALL_MEMBERS)",
      ),
    afk_channel_id: snowflake
      .nullish()
      .describe("Channel ID for voice AFK timeouts, or null to disable AFK channel"),
    afk_timeout: z
      .number()
      .int()
      .nullish()
      .describe("Voice AFK timeout duration in seconds (60, 300, 900, 1800, or 3600)"),
    icon: z
      .string()
      .nullish()
      .describe("Base64 1024x1024 image data URI for the server icon, or null to remove"),
    splash: z
      .string()
      .nullish()
      .describe(
        "Base64 16:9 image data URI for the server invite splash image, or null to remove (requires INVITE_SPLASH feature)",
      ),
    discovery_splash: z
      .string()
      .nullish()
      .describe(
        "Base64 16:9 image data URI for Discovery splash background, or null to remove (requires DISCOVERABLE feature)",
      ),
    banner: z
      .string()
      .nullish()
      .describe(
        "Base64 16:9 image data URI for guild banner, or null to remove (requires BANNER feature)",
      ),
    home_header: z
      .string()
      .nullish()
      .describe(
        "Base64 image data URI for the server Guide/Home tab header banner, or null to remove",
      ),
    system_channel_id: snowflake
      .nullish()
      .describe(
        "Channel ID where system messages like join notices and boost alerts are sent, or null to disable",
      ),
    system_channel_flags: z
      .number()
      .int()
      .nullish()
      .describe(
        "Bitfield of system channel notifications to suppress, summed: 1 member join, 2 server boost, 4 server setup tips, 8 member join sticker reply buttons, 16 role subscription purchases, 32 role subscription sticker reply buttons",
      ),
    rules_channel_id: snowflake
      .nullish()
      .describe(
        "Channel ID where community rules and guidelines are posted (requires Community server)",
      ),
    public_updates_channel_id: snowflake
      .nullish()
      .describe(
        "Channel ID where Discord community notices and updates are received (requires Community server)",
      ),
    preferred_locale: z
      .string()
      .nullish()
      .describe("Preferred locale for Community servers (e.g. 'en-US', 'de', 'fr')"),
    features: z
      .array(z.string())
      .optional()
      .describe(
        "Complete list of guild feature strings to set (for example COMMUNITY, DISCOVERABLE). Replaces the current list; Discord only lets a bot change a few features",
      ),
    description: z
      .string()
      .max(300)
      .nullish()
      .describe(
        "Guild description displayed in Discovery and Community profiles (up to 300 characters)",
      ),
    premium_progress_bar_enabled: z
      .boolean()
      .optional()
      .describe("Whether the server boost progress bar is visible above the channel list"),
    safety_alerts_channel_id: snowflake
      .nullish()
      .describe("Channel ID where safety alerts and raid notifications are posted by Discord"),
    reason,
  }),
  output: z.object({ guild }),
  execute: async ({ guild_id, reason, ...body }, { discord }) => ({
    guild: await discord<RESTPatchAPIGuildResult>({
      method: "PATCH",
      route: Routes.guild(guild_id),
      body,
      reason,
    }),
  }),
});
