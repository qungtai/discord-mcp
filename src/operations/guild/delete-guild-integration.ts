import { type RESTDeleteAPIGuildIntegrationResult, Routes } from "discord-api-types/v10";
import { z } from "zod/v4";
import { defineTool } from "../../core/tool-registry.js";
import { reason, snowflake } from "../schemas.js";
import { guildIds } from "./schemas.js";

export const deleteGuildIntegration = defineTool({
  name: "discord_delete_guild_integration",
  description:
    "Delete an integration from a guild. Discord also deletes the webhooks tied to it and kicks the associated bot, if there is one. This cannot be undone. Find integration IDs with discord_list_guild_integrations. Returns the guild and integration IDs.",
  operationIds: ["delete_guild_integration"],
  toolset: "guild",
  scope: { guild: "guild_id" },
  permissions: ["ManageGuild"],
  effect: "destructive",
  idempotent: true,
  input: z.object({
    ...guildIds,
    integration_id: snowflake.describe(
      "ID of the integration to delete (numeric snowflake string)",
    ),
    reason,
  }),
  output: z.object({
    deleted: z.literal(true),
    guild_id: snowflake,
    integration_id: snowflake,
  }),
  execute: async ({ guild_id, integration_id, reason }, { discord }) => {
    await discord<RESTDeleteAPIGuildIntegrationResult>({
      method: "DELETE",
      route: Routes.guildIntegration(guild_id, integration_id),
      reason,
    });
    return {
      deleted: true as const,
      guild_id,
      integration_id,
    };
  },
});
