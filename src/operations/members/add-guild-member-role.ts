import { type RESTPutAPIGuildMemberRoleResult, Routes } from "discord-api-types/v10";
import { z } from "zod/v4";
import { defineTool } from "../../core/tool-registry.js";
import { reason, snowflake } from "../schemas.js";

export const addGuildMemberRole = defineTool({
  name: "discord_add_guild_member_role",
  description:
    "Add a single role to a guild member. The bot cannot add roles ranked at or above its own highest role, nor can it modify the guild owner. To assign multiple roles at once or replace all roles, use discord_update_guild_member.",
  operationIds: ["add_guild_member_role"],
  toolset: "members",
  scope: { guild: "guild_id" },
  permissions: ["ManageRoles"],
  effect: "write",
  // Assigning a role grants its permissions and needs a prompt.
  approval: true,
  idempotent: true,
  output: z.object({
    added: z.literal(true),
    guild_id: snowflake,
    user_id: snowflake,
    role_id: snowflake,
  }),
  input: z.object({
    guild_id: snowflake.describe("ID of the guild"),
    user_id: snowflake.describe("ID of the user member to add the role to"),
    role_id: snowflake.describe("ID of the role to assign to the member"),
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
