import { type RESTDeleteAPIGuildRoleResult, Routes } from "discord-api-types/v10";
import { z } from "zod/v4";
import { defineTool } from "../../core/tool-registry.js";
import { reason, snowflake } from "../schemas.js";

export const deleteGuildRole = defineTool({
  name: "discord_delete_guild_role",
  description: "Delete a guild role",
  operationIds: ["delete_guild_role"],
  toolset: "roles",
  scope: { guild: "guild_id" },
  permissions: ["ManageRoles"],
  effect: "destructive",
  idempotent: true,
  input: z.object({
    guild_id: snowflake,
    role_id: snowflake,
    reason,
  }),
  output: z.object({
    deleted: z.literal(true),
    guild_id: snowflake,
    role_id: snowflake,
  }),
  execute: async ({ guild_id, role_id, reason }, { discord }) => {
    await discord<RESTDeleteAPIGuildRoleResult>({
      method: "DELETE",
      route: Routes.guildRole(guild_id, role_id),
      reason,
    });
    return { deleted: true as const, guild_id, role_id };
  },
});
