import { type RESTGetAPIGuildRoleMemberCountsResult, Routes } from "discord-api-types/v10";
import { z } from "zod/v4";
import { defineTool } from "../../core/tool-registry.js";
import { snowflake } from "../schemas.js";
import { roleMemberCountsResult } from "./schemas.js";

export const getGuildRoleMemberCounts = defineTool({
  name: "discord_get_guild_role_member_counts",
  description:
    "Retrieve the count of members assigned to each role in a guild. Useful for analyzing role usage and auditing membership across tiers without fetching all member records. To list the full metadata of each role use discord_list_guild_roles. Returns a mapping of role ID snowflakes to integer member counts.",
  operationIds: ["guild_role_member_counts"],
  toolset: "roles",
  scope: { guild: "guild_id" },
  permissions: [],
  effect: "read",
  idempotent: true,
  input: z.object({
    guild_id: snowflake.describe(
      "ID of the guild whose role member counts to retrieve (numeric snowflake string)",
    ),
  }),
  output: roleMemberCountsResult,
  execute: async ({ guild_id }, { discord }) => ({
    counts: await discord<RESTGetAPIGuildRoleMemberCountsResult>({
      method: "GET",
      route: Routes.guildRoleMemberCounts(guild_id),
    }),
  }),
});
