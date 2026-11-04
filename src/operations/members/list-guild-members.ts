import { type RESTGetAPIGuildMembersResult, Routes } from "discord-api-types/v10";
import { z } from "zod/v4";
import { defineTool } from "../../core/tool-registry.js";
import { member, snowflake } from "../schemas.js";

export const listGuildMembers = defineTool({
  name: "discord_list_guild_members",
  description:
    "List members of a guild, ordered by user ID ascending. Requires the Server Members privileged Gateway intent (GUILD_MEMBERS). Page with after=next_after. To search members by username prefix instead, use discord_search_guild_members.",
  operationIds: ["list_guild_members"],
  toolset: "members",
  scope: { guild: "guild_id" },
  permissions: [],
  effect: "read",
  idempotent: true,
  output: z.object({
    members: z.array(member),
    next_after: snowflake.nullable(),
  }),
  input: z.object({
    guild_id: snowflake.describe("ID of the guild"),
    limit: z
      .number()
      .int()
      .min(1)
      .max(1000)
      .optional()
      .describe("Max number of members to return (1-1000, default 1)"),
    after: snowflake
      .optional()
      .describe("Highest user ID from previous page to fetch members after; use next_after"),
  }),
  execute: async ({ guild_id, ...query }, { discord }) => {
    const members = await discord<RESTGetAPIGuildMembersResult>({
      method: "GET",
      route: Routes.guildMembers(guild_id),
      query,
    });
    return {
      members,
      next_after: members.at(-1)?.user?.id ?? null,
    };
  },
});
