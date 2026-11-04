import { type RESTPutAPIGuildBanResult, Routes } from "discord-api-types/v10";
import { z } from "zod/v4";
import { defineTool } from "../../core/tool-registry.js";
import { reason, snowflake } from "../schemas.js";

export const banUserFromGuild = defineTool({
  name: "discord_ban_user_from_guild",
  description:
    "Ban a user from a guild and optionally purge their recent messages up to 7 days (604800 seconds). The bot cannot ban the guild owner or members whose highest role is equal to or higher than the bot's highest role. To ban multiple users at once, use discord_bulk_ban_users_from_guild. To kick without banning, use discord_delete_guild_member.",
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
    guild_id: snowflake.describe("ID of the guild"),
    user_id: snowflake.describe("ID of the user to ban"),
    delete_message_seconds: z
      .number()
      .int()
      .min(0)
      .max(604800)
      .optional()
      .describe(
        "Number of seconds of recent messages by this user to delete (0 to 604800 seconds / 7 days, default 0)",
      ),
    reason,
  }),
  execute: async ({ guild_id, user_id, reason, ...body }, { discord }) => {
    await discord<RESTPutAPIGuildBanResult>({
      method: "PUT",
      route: Routes.guildBan(guild_id, user_id),
      body,
      reason,
    });
    return {
      banned: true as const,
      guild_id,
      user_id,
    };
  },
});
