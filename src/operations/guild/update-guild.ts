import { type RESTPatchAPIGuildResult, Routes } from "discord-api-types/v10";
import { z } from "zod/v4";
import { defineTool } from "../../core/tool-registry.js";
import { reason, snowflake } from "../schemas.js";
import { guild, guildIds } from "./guild-settings-schemas.js";

export const updateGuild = defineTool({
  name: "discord_update_guild",
  description: "Update guild settings",
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
    name: z.string().min(2).max(100).optional(),
    region: z.string().nullish(),
    verification_level: z.number().nullish(),
    default_message_notifications: z.number().nullish(),
    explicit_content_filter: z.number().nullish(),
    afk_channel_id: snowflake.nullish(),
    afk_timeout: z.number().optional(),
    icon: z.string().nullish().describe("Base64 1024x1024 image data"),
    splash: z.string().nullish().describe("Base64 16:9 image data"),
    discovery_splash: z.string().nullish().describe("Base64 image data"),
    banner: z.string().nullish().describe("Base64 16:9 image data"),
    system_channel_id: snowflake.nullish(),
    system_channel_flags: z.number().optional(),
    rules_channel_id: snowflake.nullish(),
    public_updates_channel_id: snowflake.nullish(),
    preferred_locale: z.string().nullish(),
    features: z.array(z.string()).optional(),
    description: z.string().max(300).nullish(),
    premium_progress_bar_enabled: z.boolean().optional(),
    safety_alerts_channel_id: snowflake.nullish(),
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
