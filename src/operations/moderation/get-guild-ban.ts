import { type RESTGetAPIGuildBanResult, Routes } from "discord-api-types/v10";
import { z } from "zod/v4";
import { defineTool } from "../../core/tool-registry.js";
import { snowflake } from "../schemas.js";
import { ban } from "./schemas.js";

export const getGuildBan = defineTool({
  name: "discord_get_guild_ban",
  description: "Get ban information for a user in a guild",
  operationIds: ["get_guild_ban"],
  toolset: "moderation",
  scope: { guild: "guild_id" },
  permissions: ["BanMembers"],
  effect: "read",
  idempotent: true,
  output: z.object({ ban }),
  input: z.object({
    guild_id: snowflake,
    user_id: snowflake,
  }),
  execute: async ({ guild_id, user_id }, { discord }) => ({
    ban: await discord<RESTGetAPIGuildBanResult>({
      method: "GET",
      route: Routes.guildBan(guild_id, user_id),
    }),
  }),
});
