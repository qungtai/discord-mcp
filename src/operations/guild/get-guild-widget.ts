import { type RESTGetAPIGuildWidgetJSONResult, Routes } from "discord-api-types/v10";
import { z } from "zod/v4";
import { defineTool } from "../../core/tool-registry.js";
import { guildIds, widget } from "./schemas.js";

export const getGuildWidget = defineTool({
  name: "discord_get_guild_widget",
  description:
    "Fetch public widget JSON data for a guild, including active voice channels and online members. Requires the guild widget to be enabled in widget settings. To view or toggle widget configuration use discord_get_guild_widget_settings or discord_update_guild_widget_settings. Returns public widget info including channel list and online presence count.",
  operationIds: ["get_guild_widget"],
  toolset: "guild",
  scope: { guild: "guild_id" },
  permissions: [],
  effect: "read",
  idempotent: true,
  input: z.object(guildIds),
  output: z.object({ widget }),
  execute: async ({ guild_id }, { discord }) => ({
    widget: await discord<RESTGetAPIGuildWidgetJSONResult>({
      method: "GET",
      route: Routes.guildWidgetJSON(guild_id),
    }),
  }),
});
