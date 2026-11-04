import { type RESTPostAPIGuildBulkBanResult, Routes } from "discord-api-types/v10";
import { z } from "zod/v4";
import { defineTool } from "../../core/tool-registry.js";
import { reason, snowflake } from "../schemas.js";

export const bulkBanUsersFromGuild = defineTool({
  name: "discord_bulk_ban_users_from_guild",
  description:
    "Ban a list of up to 200 users from a guild simultaneously and optionally purge their messages up to 7 days (604800 seconds). The bot cannot ban the guild owner or members above its highest role. Returns lists of successfully banned user IDs and failed user IDs. To ban a single user, use discord_ban_user_from_guild.",
  operationIds: ["bulk_ban_users_from_guild"],
  toolset: "moderation",
  scope: { guild: "guild_id" },
  permissions: ["BanMembers", "ManageGuild"],
  effect: "destructive",
  idempotent: false,
  output: z.object({
    banned_users: z.array(snowflake),
    failed_users: z.array(snowflake),
  }),
  input: z.object({
    guild_id: snowflake.describe("ID of the guild"),
    user_ids: z
      .array(snowflake)
      .min(1)
      .max(200)
      .describe("Array of 1 to 200 user IDs to ban from the guild"),
    delete_message_seconds: z
      .number()
      .int()
      .min(0)
      .max(604800)
      .optional()
      .describe(
        "Number of seconds of recent messages by banned users to delete (0 to 604800 seconds / 7 days, default 0)",
      ),
    reason,
  }),
  execute: ({ guild_id, reason, ...body }, { discord }) =>
    discord<RESTPostAPIGuildBulkBanResult>({
      method: "POST",
      route: Routes.guildBulkBan(guild_id),
      body,
      reason,
    }),
});
