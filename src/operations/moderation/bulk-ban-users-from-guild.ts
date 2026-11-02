import { type RESTPostAPIGuildBulkBanResult, Routes } from "discord-api-types/v10";
import { z } from "zod/v4";
import { defineTool } from "../../core/tool-registry.js";
import { reason, snowflake } from "../schemas.js";

export const bulkBanUsersFromGuild = defineTool({
  name: "discord_bulk_ban_users_from_guild",
  description: "Ban up to 200 users from a guild and optionally delete their messages",
  operationIds: ["bulk_ban_users_from_guild"],
  toolset: "moderation",
  scope: { guild: "guild_id" },
  permissions: ["BanMembers"],
  effect: "destructive",
  idempotent: false,
  output: z.object({
    banned_users: z.array(snowflake),
    failed_users: z.array(snowflake),
  }),
  input: z.object({
    guild_id: snowflake,
    user_ids: z.array(snowflake).min(1).max(200),
    delete_message_seconds: z.number().int().min(0).max(604800).optional(),
    reason,
  }),
  execute: async ({ guild_id, reason: auditReason, ...body }, { discord }) => {
    return discord<RESTPostAPIGuildBulkBanResult>({
      method: "POST",
      route: Routes.guildBulkBan(guild_id),
      body,
      reason: auditReason,
    });
  },
});
