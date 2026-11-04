import { type RESTPatchAPIGuildWidgetSettingsResult, Routes } from "discord-api-types/v10";
import { z } from "zod/v4";
import { defineTool } from "../../core/tool-registry.js";
import { reason, snowflake } from "../schemas.js";
import { guildIds, widgetSettings } from "./schemas.js";

export const updateGuildWidgetSettings = defineTool({
  name: "discord_update_guild_widget_settings",
  description:
    "Update widget configuration for a guild to enable or disable the widget and set its invite channel. To inspect current widget settings before modifying use discord_get_guild_widget_settings, or fetch the live JSON widget via discord_get_guild_widget. Returns the updated widget settings.",
  operationIds: ["update_guild_widget_settings"],
  toolset: "guild",
  scope: {
    guild: "guild_id",
    channel: "channel_id",
  },
  permissions: ["ManageGuild"],
  effect: "destructive",
  idempotent: true,
  input: z.object({
    ...guildIds,
    enabled: z.boolean().nullish().describe("Whether the guild widget is enabled"),
    channel_id: snowflake
      .nullish()
      .describe("Channel ID for widget invite generation, or null to disable widget invites"),
    reason,
  }),
  output: z.object({ widget_settings: widgetSettings }),
  execute: async ({ guild_id, reason, ...body }, { discord }) => ({
    widget_settings: await discord<RESTPatchAPIGuildWidgetSettingsResult>({
      method: "PATCH",
      route: Routes.guildWidgetSettings(guild_id),
      body,
      reason,
    }),
  }),
});
