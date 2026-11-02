import { type RESTGetAPIGuildRoleResult, Routes } from "discord-api-types/v10";
import { z } from "zod/v4";
import { defineTool } from "../../core/tool-registry.js";
import { snowflake } from "../schemas.js";
import { roleResult } from "./schemas.js";

export const getGuildRole = defineTool({
  name: "discord_get_guild_role",
  description: "Get a guild role",
  operationIds: ["get_guild_role"],
  toolset: "roles",
  scope: { guild: "guild_id" },
  permissions: [],
  effect: "read",
  idempotent: true,
  input: z.object({
    guild_id: snowflake,
    role_id: snowflake,
  }),
  output: roleResult,
  execute: async ({ guild_id, role_id }, { discord }) => ({
    role: await discord<RESTGetAPIGuildRoleResult>({
      method: "GET",
      route: Routes.guildRole(guild_id, role_id),
    }),
  }),
});
