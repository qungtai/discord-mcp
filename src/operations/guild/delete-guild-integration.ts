import { type RESTDeleteAPIGuildIntegrationResult, Routes } from "discord-api-types/v10";
import { z } from "zod/v4";
import { defineTool } from "../../core/tool-registry.js";
import { reason, snowflake } from "../schemas.js";
import { guildIds } from "./schemas.js";

export const deleteGuildIntegration = defineTool({
  name: "discord_delete_guild_integration",
  description:
    "Delete an attached integration from a guild by integration ID. Deleting an integration removes any linked synchronization or webhook access. To inspect active integrations first use discord_list_guild_integrations. Returns confirmation with deleted IDs.",
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
