import { type RESTGetAPIGuildMembersSearchResult, Routes } from "discord-api-types/v10";
import { z } from "zod/v4";
import { defineTool } from "../../core/tool-registry.js";
import { member, snowflake } from "../schemas.js";

export const searchGuildMembers = defineTool({
  name: "discord_search_guild_members",
  description:
    "Search guild members whose username or nickname starts with the query string. Returns matching member objects, up to limit (default 1). To page through every member by ID use discord_list_guild_members.",
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
    guild_id: snowflake.describe("ID of the guild to search members in"),
    query: z
      .string()
      .min(1)
      .max(100)
      .describe(
        "Prefix query string to match against member username or nickname (1-100 characters)",
      ),
    limit: z
      .number()
      .int()
      .min(1)
      .max(1000)
      .optional()
      .describe("Max number of members to return (1-1000, default 1)"),
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
