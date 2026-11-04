import { type RESTGetAPIGuildWidgetSettingsResult, Routes } from "discord-api-types/v10";
import { z } from "zod/v4";
import { defineTool } from "../../core/tool-registry.js";
import { guildIds, widgetSettings } from "./schemas.js";

export const getGuildWidgetSettings = defineTool({
  name: "discord_get_guild_widget_settings",
  description:
    "Retrieve widget settings for a guild, indicating whether the embeddable widget is enabled and which channel it binds to. To read the rendered widget payload with member presences use discord_get_guild_widget. To toggle the widget or change its invite channel use discord_update_guild_widget_settings. Returns whether the widget is enabled and its channel ID.",
  operationIds: ["get_guild_widget_settings"],
  toolset: "guild",
  scope: { guild: "guild_id" },
  permissions: ["ManageGuild"],
  effect: "read",
  idempotent: true,
  input: z.object(guildIds),
  output: z.object({ widget_settings: widgetSettings }),
  execute: async ({ guild_id }, { discord }) => ({
    widget_settings: await discord<RESTGetAPIGuildWidgetSettingsResult>({
      method: "GET",
      route: Routes.guildWidgetSettings(guild_id),
    }),
  }),
});
