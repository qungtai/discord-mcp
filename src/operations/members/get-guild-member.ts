import { type RESTGetAPIGuildMemberResult, Routes } from "discord-api-types/v10";
import { z } from "zod/v4";
import { defineTool } from "../../core/tool-registry.js";
import { member, snowflake } from "../schemas.js";

export const getGuildMember = defineTool({
  name: "discord_get_guild_member",
  description: "Get a guild member by user ID",
  operationIds: ["get_guild_member"],
  toolset: "members",
  scope: { guild: "guild_id" },
  permissions: [],
  effect: "read",
  idempotent: true,
  output: z.object({
    member,
  }),
  input: z.object({
    guild_id: snowflake,
    user_id: snowflake,
  }),
  execute: async ({ guild_id, user_id }, { discord }) => ({
    member: await discord<RESTGetAPIGuildMemberResult>({
      method: "GET",
      route: Routes.guildMember(guild_id, user_id),
    }),
  }),
});
