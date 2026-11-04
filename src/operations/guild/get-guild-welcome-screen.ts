import { type RESTGetAPIGuildWelcomeScreenResult, Routes } from "discord-api-types/v10";
import { z } from "zod/v4";
import { defineTool } from "../../core/tool-registry.js";
import { guildIds, welcomeScreen } from "./schemas.js";

export const getGuildWelcomeScreen = defineTool({
  name: "discord_get_guild_welcome_screen",
  description:
    "Retrieve the welcome screen of a guild: its description and up to 5 featured channels. The welcome screen is a Community server feature. To change it use discord_update_guild_welcome_screen. Returns the welcome screen object.",
  operationIds: ["get_guild_welcome_screen"],
  toolset: "guild",
  scope: { guild: "guild_id" },
  permissions: ["ManageGuild"],
  effect: "read",
  idempotent: true,
  input: z.object(guildIds),
  output: z.object({ welcome_screen: welcomeScreen }),
  execute: async ({ guild_id }, { discord }) => ({
    welcome_screen: await discord<RESTGetAPIGuildWelcomeScreenResult>({
      method: "GET",
      route: Routes.guildWelcomeScreen(guild_id),
    }),
  }),
});
