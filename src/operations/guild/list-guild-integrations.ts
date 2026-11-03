import { type RESTGetAPIGuildIntegrationsResult, Routes } from "discord-api-types/v10";
import { z } from "zod/v4";
import { defineTool } from "../../core/tool-registry.js";
import { guildIds, integration } from "./schemas.js";

export const listGuildIntegrations = defineTool({
  name: "discord_list_guild_integrations",
  description: "List integrations for a guild",
  operationIds: ["list_guild_integrations"],
  toolset: "guild",
  scope: { guild: "guild_id" },
  permissions: ["ManageGuild"],
  effect: "read",
  idempotent: true,
  input: z.object(guildIds),
  output: z.object({ integrations: z.array(integration) }),
  execute: async ({ guild_id }, { discord }) => ({
    integrations: await discord<RESTGetAPIGuildIntegrationsResult>({
      method: "GET",
      route: Routes.guildIntegrations(guild_id),
    }),
  }),
});
