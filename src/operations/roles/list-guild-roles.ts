import { type RESTGetAPIGuildRolesResult, Routes } from "discord-api-types/v10";
import { z } from "zod/v4";
import { defineTool } from "../../core/tool-registry.js";
import { snowflake } from "../schemas.js";
import { rolesResult } from "./schemas.js";

export const listGuildRoles = defineTool({
  name: "discord_list_guild_roles",
  description:
    "List every role configured in a guild, including @everyone, bot integration roles, and booster roles. To fetch member counts across roles use discord_get_guild_role_member_counts, or to create a new role use discord_create_guild_role. Returns every role object, each with its position.",
  operationIds: ["list_guild_roles"],
  toolset: "roles",
  scope: { guild: "guild_id" },
  permissions: [],
  effect: "read",
  idempotent: true,
  input: z.object({
    guild_id: snowflake.describe("ID of the guild whose roles to list (numeric snowflake string)"),
  }),
  output: rolesResult,
  execute: async ({ guild_id }, { discord }) => ({
    roles: await discord<RESTGetAPIGuildRolesResult>({
      method: "GET",
      route: Routes.guildRoles(guild_id),
    }),
  }),
});
