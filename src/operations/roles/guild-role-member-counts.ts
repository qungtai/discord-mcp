import { type RESTGetAPIGuildRoleMemberCountsResult, Routes } from "discord-api-types/v10";
import { z } from "zod/v4";
import { defineTool } from "../../core/tool-registry.js";
import { snowflake } from "../schemas.js";
import { roleMemberCountsResult } from "./guild-roles-schemas.js";

export const guildRoleMemberCounts = defineTool({
  name: "discord_guild_role_member_counts",
  description: "Get role member counts for a guild",
  operationIds: ["guild_role_member_counts"],
  toolset: "roles",
  scope: { guild: "guild_id" },
  permissions: ["ManageRoles"],
  effect: "read",
  idempotent: true,
  input: z.object({ guild_id: snowflake }),
  output: roleMemberCountsResult,
  execute: async ({ guild_id }, { discord }) => ({
    counts: await discord<RESTGetAPIGuildRoleMemberCountsResult>({
      method: "GET",
      route: Routes.guildRoleMemberCounts(guild_id),
    }),
  }),
});
