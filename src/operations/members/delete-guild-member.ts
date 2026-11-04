import { type RESTDeleteAPIGuildMemberResult, Routes } from "discord-api-types/v10";
import { z } from "zod/v4";
import { defineTool } from "../../core/tool-registry.js";
import { reason, snowflake } from "../schemas.js";

export const deleteGuildMember = defineTool({
  name: "discord_delete_guild_member",
  description:
    "Remove (kick) a member from a guild. The bot cannot kick the guild owner or any member whose highest role is equal to or higher than the bot's highest role. To ban a user and delete their message history instead, use discord_ban_user_from_guild.",
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
    guild_id: snowflake.describe("ID of the guild"),
    user_id: snowflake.describe("ID of the user member to kick"),
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
