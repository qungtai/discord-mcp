import { type RESTGetAPIGuildWidgetSettingsResult, Routes } from "discord-api-types/v10";
import { z } from "zod/v4";
import { defineTool } from "../../core/tool-registry.js";
import { guildIds, widgetSettings } from "./guild-settings-schemas.js";

export const getGuildWidgetSettings = defineTool({
  name: "discord_get_guild_widget_settings",
  description: "Get widget settings for a guild",
  operationIds: ["get_guild_widget_settings"],
  toolset: "guild",
  scope: { guild: "guild_id" },
  permissions: ["ManageGuild"],
  effect: "read",
  idempotent: true,
  input: z.object(guildIds),
  output: z.object({ widget_settings: widgetSettings }),
  execute: async ({ guild_id }, { discord }) => ({
    widget_settings: (await discord<RESTGetAPIGuildWidgetSettingsResult>({
      method: "GET",
      route: Routes.guildWidgetSettings(guild_id),
    })) as unknown as { [x: string]: unknown },
  }),
});
