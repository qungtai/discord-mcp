import { type RESTDeleteAPIGuildRoleResult, Routes } from "discord-api-types/v10";
import { z } from "zod/v4";
import { defineTool } from "../../core/tool-registry.js";
import { reason, snowflake } from "../schemas.js";

export const deleteGuildRole = defineTool({
  name: "discord_delete_guild_role",
  description:
    "Delete a role from a guild by role ID. Under role hierarchy rules, the bot can only delete roles positioned strictly below the bot highest role; managed integration roles and the @everyone role cannot be deleted. To remove a role from a specific member instead use discord_delete_guild_member_role. Returns confirmation with deleted IDs.",
  operationIds: ["delete_guild_role"],
  toolset: "roles",
  scope: { guild: "guild_id" },
  permissions: ["ManageRoles"],
  effect: "destructive",
  idempotent: true,
  input: z.object({
    guild_id: snowflake.describe(
      "ID of the guild where the role exists (numeric snowflake string)",
    ),
    role_id: snowflake.describe("ID of the role to delete (numeric snowflake string)"),
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
