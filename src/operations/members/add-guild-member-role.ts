import { type RESTPutAPIGuildMemberRoleResult, Routes } from "discord-api-types/v10";
import { z } from "zod/v4";
import { defineTool } from "../../core/tool-registry.js";
import { reason, snowflake } from "../schemas.js";

export const addGuildMemberRole = defineTool({
  name: "discord_add_guild_member_role",
  description: "Add a role to a guild member",
  operationIds: ["add_guild_member_role"],
  toolset: "members",
  scope: { guild: "guild_id" },
  permissions: ["ManageRoles"],
  effect: "write",
  idempotent: true,
  output: z.object({
    added: z.literal(true),
    guild_id: snowflake,
    user_id: snowflake,
    role_id: snowflake,
  }),
  input: z.object({
    guild_id: snowflake,
    user_id: snowflake,
    role_id: snowflake,
    reason,
  }),
  execute: async ({ guild_id, user_id, role_id, reason }, { discord }) => {
    await discord<RESTPutAPIGuildMemberRoleResult>({
      method: "PUT",
      route: Routes.guildMemberRole(guild_id, user_id, role_id),
      reason,
    });
    return {
      added: true as const,
      guild_id,
      user_id,
      role_id,
    };
  },
});
