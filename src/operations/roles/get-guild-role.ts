import { type RESTGetAPIGuildRoleResult, Routes } from "discord-api-types/v10";
import { z } from "zod/v4";
import { defineTool } from "../../core/tool-registry.js";
import { snowflake } from "../schemas.js";
import { roleResult } from "./schemas.js";

export const getGuildRole = defineTool({
  name: "discord_get_guild_role",
  description:
    "Fetch a single role by role ID within a guild. To list all roles belonging to the guild at once use discord_list_guild_roles. To view channel-specific permissions computed for a role use discord_get_role_permissions. Returns the complete role object including name, color, hoist status, position, and permission bits.",
  operationIds: ["get_guild_role"],
  toolset: "roles",
  scope: { guild: "guild_id" },
  permissions: [],
  effect: "read",
  idempotent: true,
  input: z.object({
    guild_id: snowflake.describe("ID of the guild that owns the role (numeric snowflake string)"),
    role_id: snowflake.describe("ID of the role to fetch (numeric snowflake string)"),
  }),
  output: roleResult,
  execute: async ({ guild_id, role_id }, { discord }) => ({
    role: await discord<RESTGetAPIGuildRoleResult>({
      method: "GET",
      route: Routes.guildRole(guild_id, role_id),
    }),
  }),
});
