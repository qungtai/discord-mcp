import { type RESTDeleteAPIGuildMemberResult, Routes } from "discord-api-types/v10";
import { z } from "zod/v4";
import { defineTool } from "../../core/tool-registry.js";
import { reason, snowflake } from "../schemas.js";

export const deleteGuildMember = defineTool({
  name: "discord_delete_guild_member",
  description: "Remove (kick) a member from a guild",
  operationIds: ["delete_guild_member"],
  toolset: "members",
  scope: { guild: "guild_id" },
  permissions: ["KickMembers"],
  effect: "destructive",
  idempotent: true,
  output: z.object({
    deleted: z.literal(true),
    guild_id: snowflake,
    user_id: snowflake,
  }),
  input: z.object({
    guild_id: snowflake,
    user_id: snowflake,
    reason,
  }),
  execute: async ({ guild_id, user_id, reason }, { discord }) => {
    await discord<RESTDeleteAPIGuildMemberResult>({
      method: "DELETE",
      route: Routes.guildMember(guild_id, user_id),
      reason,
    });
    return {
      deleted: true as const,
      guild_id,
      user_id,
    };
  },
});
