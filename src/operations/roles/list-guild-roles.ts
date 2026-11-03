import { type RESTGetAPIGuildRolesResult, Routes } from "discord-api-types/v10";
import { z } from "zod/v4";
import { defineTool } from "../../core/tool-registry.js";
import { snowflake } from "../schemas.js";
import { rolesResult } from "./schemas.js";

export const listGuildRoles = defineTool({
  name: "discord_list_guild_roles",
  description: "List roles in a guild",
  operationIds: ["list_guild_roles"],
  toolset: "roles",
  scope: { guild: "guild_id" },
  permissions: [],
  effect: "read",
  idempotent: true,
  input: z.object({ guild_id: snowflake }),
  output: rolesResult,
  execute: async ({ guild_id }, { discord }) => ({
    roles: await discord<RESTGetAPIGuildRolesResult>({
      method: "GET",
      route: Routes.guildRoles(guild_id),
    }),
  }),
});
