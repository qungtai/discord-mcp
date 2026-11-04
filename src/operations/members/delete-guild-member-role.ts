import { type RESTDeleteAPIGuildMemberRoleResult, Routes } from "discord-api-types/v10";
import { z } from "zod/v4";
import { defineTool } from "../../core/tool-registry.js";
import { reason, snowflake } from "../schemas.js";

export const deleteGuildMemberRole = defineTool({
  name: "discord_delete_guild_member_role",
  description:
    "Remove a single role from a guild member. The bot cannot remove roles ranked at or above its own highest role, nor can it modify the guild owner. To assign a role instead use discord_add_guild_member_role.",
  operationIds: ["delete_guild_member_role"],
  toolset: "members",
  scope: { guild: "guild_id" },
  permissions: ["ManageRoles"],
  effect: "destructive",
  idempotent: true,
  output: z.object({
    deleted: z.literal(true),
    guild_id: snowflake,
    user_id: snowflake,
    role_id: snowflake,
  }),
  input: z.object({
    guild_id: snowflake.describe("ID of the guild"),
    user_id: snowflake.describe("ID of the user member to remove the role from"),
    role_id: snowflake.describe("ID of the role to remove from the member"),
    reason,
  }),
  execute: async ({ guild_id, user_id, role_id, reason }, { discord }) => {
    await discord<RESTDeleteAPIGuildMemberRoleResult>({
      method: "DELETE",
      route: Routes.guildMemberRole(guild_id, user_id, role_id),
      reason,
    });
    return {
      deleted: true as const,
      guild_id,
      user_id,
      role_id,
    };
  },
});
