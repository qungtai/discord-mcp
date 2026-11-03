import { type RESTGetAPIGuildMembersResult, Routes } from "discord-api-types/v10";
import { z } from "zod/v4";
import { defineTool } from "../../core/tool-registry.js";
import { member, snowflake } from "../schemas.js";

export const listGuildMembers = defineTool({
  name: "discord_list_guild_members",
  description:
    "List guild members. Requires the Server Members privileged Gateway intent (GUILD_MEMBERS). Page with after=next_after",
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
    guild_id: snowflake,
    limit: z.number().int().min(1).max(1000).optional(),
    after: snowflake.optional(),
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
