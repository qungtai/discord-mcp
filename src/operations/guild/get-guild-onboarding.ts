import { type RESTGetAPIGuildOnboardingResult, Routes } from "discord-api-types/v10";
import { z } from "zod/v4";
import { defineTool } from "../../core/tool-registry.js";
import { guildIds, onboarding } from "./schemas.js";

export const getGuildOnboarding = defineTool({
  name: "discord_get_guild_onboarding",
  description:
    "Retrieve the onboarding setup of a guild: prompts with their options, default channels, whether onboarding is enabled, and the mode. Onboarding is a Community server feature. To change it use discord_update_guild_onboarding. Returns the onboarding object.",
  operationIds: ["get_guilds_onboarding"],
  toolset: "guild",
  scope: { guild: "guild_id" },
  permissions: ["ManageGuild"],
  effect: "read",
  idempotent: true,
  input: z.object(guildIds),
  output: z.object({ onboarding }),
  execute: async ({ guild_id }, { discord }) => ({
    onboarding: await discord<RESTGetAPIGuildOnboardingResult>({
      method: "GET",
      route: Routes.guildOnboarding(guild_id),
    }),
  }),
});
