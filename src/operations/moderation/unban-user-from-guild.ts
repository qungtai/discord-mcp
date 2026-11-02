import { type RESTDeleteAPIGuildBanResult, Routes } from "discord-api-types/v10";
import { z } from "zod/v4";
import { defineTool } from "../../core/tool-registry.js";
import { reason, snowflake } from "../schemas.js";

export const unbanUserFromGuild = defineTool({
  name: "discord_unban_user_from_guild",
  description: "Remove the ban for a user in a guild",
  operationIds: ["unban_user_from_guild"],
  toolset: "moderation",
  scope: { guild: "guild_id" },
  permissions: ["BanMembers"],
  effect: "destructive",
  idempotent: true,
  output: z.object({
    unbanned: z.literal(true),
    guild_id: snowflake,
    user_id: snowflake,
  }),
  input: z.object({
    guild_id: snowflake,
    user_id: snowflake,
    reason,
  }),
  execute: async ({ guild_id, user_id, reason }, { discord }) => {
    await discord<RESTDeleteAPIGuildBanResult>({
      method: "DELETE",
      route: Routes.guildBan(guild_id, user_id),
      reason,
    });
    return {
      unbanned: true as const,
      guild_id,
      user_id,
    };
  },
});
