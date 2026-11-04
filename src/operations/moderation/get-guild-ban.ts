import { type RESTGetAPIGuildBanResult, Routes } from "discord-api-types/v10";
import { z } from "zod/v4";
import { defineTool } from "../../core/tool-registry.js";
import { snowflake } from "../schemas.js";
import { ban } from "./schemas.js";

export const getGuildBan = defineTool({
  name: "discord_get_guild_ban",
  description:
    "Fetch ban details for a specific user in a guild, including the banned user object and optional ban reason. Use it when checking whether a known user is banned; to list all bans in the guild, use discord_list_guild_bans. To remove the ban, use discord_unban_user_from_guild.",
  operationIds: ["get_guild_ban"],
  toolset: "moderation",
  scope: { guild: "guild_id" },
  permissions: ["BanMembers"],
  effect: "read",
  idempotent: true,
  output: z.object({ ban }),
  input: z.object({
    guild_id: snowflake.describe("ID of the guild"),
    user_id: snowflake.describe("ID of the banned user"),
  }),
  execute: async ({ guild_id, user_id }, { discord }) => ({
    ban: await discord<RESTGetAPIGuildBanResult>({
      method: "GET",
      route: Routes.guildBan(guild_id, user_id),
    }),
  }),
});
