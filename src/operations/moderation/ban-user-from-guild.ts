import { type RESTPutAPIGuildBanResult, Routes } from "discord-api-types/v10";
import { z } from "zod/v4";
import { defineTool } from "../../core/tool-registry.js";
import { reason, snowflake } from "../schemas.js";

export const banUserFromGuild = defineTool({
  name: "discord_ban_user_from_guild",
  description: "Ban a user from a guild and optionally delete their messages",
  operationIds: ["ban_user_from_guild"],
  toolset: "moderation",
  scope: { guild: "guild_id" },
  permissions: ["BanMembers"],
  effect: "destructive",
  idempotent: true,
  output: z.object({
    banned: z.literal(true),
    guild_id: snowflake,
    user_id: snowflake,
  }),
  input: z.object({
    guild_id: snowflake,
    user_id: snowflake,
    delete_message_seconds: z.number().int().min(0).max(604800).optional(),
    delete_message_days: z.number().int().min(0).max(7).optional(),
    reason,
  }),
  execute: async ({ guild_id, user_id, reason: auditReason, ...body }, { discord }) => {
    await discord<RESTPutAPIGuildBanResult>({
      method: "PUT",
      route: Routes.guildBan(guild_id, user_id),
      body,
      reason: auditReason,
    });
    return {
      banned: true as const,
      guild_id,
      user_id,
    };
  },
});
