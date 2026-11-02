import { type RESTGetAPIGuildMembersSearchResult, Routes } from "discord-api-types/v10";
import { z } from "zod/v4";
import { defineTool } from "../../core/tool-registry.js";
import { member, snowflake } from "../schemas.js";

export const searchGuildMembers = defineTool({
  name: "discord_search_guild_members",
  description:
    "Search guild members whose username or nickname starts with the query. Requires the Server Members privileged Gateway intent (GUILD_MEMBERS)",
  operationIds: ["search_guild_members"],
  toolset: "members",
  scope: { guild: "guild_id" },
  permissions: [],
  effect: "read",
  idempotent: true,
  output: z.object({
    members: z.array(member),
  }),
  input: z.object({
    guild_id: snowflake,
    query: z.string().min(1).max(100),
    limit: z.number().int().min(1).max(1000).optional(),
  }),
  execute: async ({ guild_id, ...query }, { discord }) => {
    const members = await discord<RESTGetAPIGuildMembersSearchResult>({
      method: "GET",
      route: Routes.guildMembersSearch(guild_id),
      query,
    });
    return { members };
  },
});
