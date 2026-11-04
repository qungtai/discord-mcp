import { type RESTGetAPIGuildMemberResult, Routes } from "discord-api-types/v10";
import { z } from "zod/v4";
import { defineTool } from "../../core/tool-registry.js";
import { member, snowflake } from "../schemas.js";

export const getGuildMember = defineTool({
  name: "discord_get_guild_member",
  description:
    "Fetch a single member of a guild by user ID, returning their nickname, assigned roles, join date and avatar. Use it when you already know the user ID; to paginate all members use discord_list_guild_members, or to find members by name use discord_search_guild_members.",
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
    guild_id: snowflake.describe("ID of the guild"),
    user_id: snowflake.describe("ID of the user to fetch member details for"),
  }),
  execute: async ({ guild_id, user_id }, { discord }) => ({
    member: await discord<RESTGetAPIGuildMemberResult>({
      method: "GET",
      route: Routes.guildMember(guild_id, user_id),
    }),
  }),
});
