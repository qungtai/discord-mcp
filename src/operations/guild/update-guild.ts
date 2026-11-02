import { type RESTPatchAPIGuildResult, Routes } from "discord-api-types/v10";
import { z } from "zod/v4";
import { defineTool } from "../../core/tool-registry.js";
import { reason, snowflake } from "../schemas.js";
import { guild, guildIds } from "./schemas.js";

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
    verification_level: z.number().int().nullish(),
    default_message_notifications: z.number().int().nullish(),
    explicit_content_filter: z.number().int().nullish(),
    afk_channel_id: snowflake.nullish().describe("ID of the AFK channel"),
    afk_timeout: z.number().int().nullish(),
    icon: z.string().nullish().describe("Base64 1024x1024 image data"),
    splash: z.string().nullish().describe("Base64 16:9 image data"),
    discovery_splash: z.string().nullish().describe("Base64 image data"),
    banner: z.string().nullish().describe("Base64 16:9 image data"),
    home_header: z.string().nullish().describe("Base64 image data"),
    system_channel_id: snowflake.nullish().describe("ID of system channel"),
    system_channel_flags: z.number().int().nullish(),
    rules_channel_id: snowflake.nullish().describe("ID of rules channel"),
    public_updates_channel_id: snowflake.nullish().describe("ID of public updates channel"),
    preferred_locale: z.string().nullish(),
    features: z.array(z.string()).optional(),
    description: z.string().max(300).nullish(),
    premium_progress_bar_enabled: z.boolean().optional(),
    safety_alerts_channel_id: snowflake.nullish().describe("ID of safety alerts channel"),
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
