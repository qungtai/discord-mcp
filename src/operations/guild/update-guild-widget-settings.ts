import { type RESTPatchAPIGuildWidgetSettingsResult, Routes } from "discord-api-types/v10";
import { z } from "zod/v4";
import { defineTool } from "../../core/tool-registry.js";
import { reason, snowflake } from "../schemas.js";
import { guildIds, widgetSettings } from "./guild-settings-schemas.js";

export const updateGuildWidgetSettings = defineTool({
  name: "discord_update_guild_widget_settings",
  description: "Update widget settings for a guild",
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
    enabled: z.boolean().nullish(),
    channel_id: snowflake.nullish().describe("Widget channel ID"),
    reason,
  }),
  output: z.object({ widget_settings: widgetSettings }),
  execute: async ({ guild_id, reason, ...body }, { discord }) => ({
    widget_settings: (await discord<RESTPatchAPIGuildWidgetSettingsResult>({
      method: "PATCH",
      route: Routes.guildWidgetSettings(guild_id),
      body,
      reason,
    })) as unknown as { [x: string]: unknown },
  }),
});
