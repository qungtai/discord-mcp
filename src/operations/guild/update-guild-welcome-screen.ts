import { type RESTPatchAPIGuildWelcomeScreenResult, Routes } from "discord-api-types/v10";
import { z } from "zod/v4";
import { defineTool } from "../../core/tool-registry.js";
import { reason, snowflake } from "../schemas.js";
import { guildIds, welcomeScreen } from "./schemas.js";

const welcomeScreenChannelInput = z.strictObject({
  channel_id: snowflake,
  description: z.string().min(1).max(50),
  emoji_id: snowflake.nullish(),
  emoji_name: z.string().nullish(),
});

export const updateGuildWelcomeScreen = defineTool({
  name: "discord_update_guild_welcome_screen",
  description: "Update the welcome screen for a guild",
  operationIds: ["update_guild_welcome_screen"],
  toolset: "guild",
  scope: { guild: "guild_id" },
  permissions: ["ManageGuild"],
  effect: "destructive",
  idempotent: true,
  input: z.object({
    ...guildIds,
    enabled: z.boolean().nullish(),
    welcome_channels: z.array(welcomeScreenChannelInput).max(5).nullish(),
    description: z.string().max(140).nullish(),
    reason,
  }),
  output: z.object({ welcome_screen: welcomeScreen }),
  execute: async ({ guild_id, reason, ...body }, { discord }) => ({
    welcome_screen: await discord<RESTPatchAPIGuildWelcomeScreenResult>({
      method: "PATCH",
      route: Routes.guildWelcomeScreen(guild_id),
      body,
      reason,
    }),
  }),
});
