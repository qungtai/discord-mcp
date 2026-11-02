import { type RESTGetAPIGuildOnboardingResult, Routes } from "discord-api-types/v10";
import { z } from "zod/v4";
import { defineTool } from "../../core/tool-registry.js";
import { guildIds, onboarding } from "./guild-settings-schemas.js";

export const getGuildOnboarding = defineTool({
  name: "discord_get_guild_onboarding",
  description: "Get the onboarding configuration for a guild",
  operationIds: ["get_guilds_onboarding"],
  toolset: "guild",
  scope: { guild: "guild_id" },
  permissions: ["ManageGuild"],
  effect: "read",
  idempotent: true,
  input: z.object(guildIds),
  output: z.object({ onboarding }),
  execute: async ({ guild_id }, { discord }) => ({
    onboarding: (await discord<RESTGetAPIGuildOnboardingResult>({
      method: "GET",
      route: Routes.guildOnboarding(guild_id),
    })) as unknown as { guild_id: string },
  }),
});
