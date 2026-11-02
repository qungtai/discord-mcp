import { type RESTGetAPIGuildWidgetJSONResult, Routes } from "discord-api-types/v10";
import { z } from "zod/v4";
import { defineTool } from "../../core/tool-registry.js";
import { guildIds, widget } from "./guild-settings-schemas.js";

export const getGuildWidget = defineTool({
  name: "discord_get_guild_widget",
  description: "Get the widget data for a guild",
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
