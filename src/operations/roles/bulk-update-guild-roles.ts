import {
  type RESTPatchAPIGuildRolePositionsJSONBody,
  type RESTPatchAPIGuildRolePositionsResult,
  Routes,
} from "discord-api-types/v10";
import { z } from "zod/v4";
import { defineTool } from "../../core/tool-registry.js";
import { reason, snowflake } from "../schemas.js";
import { rolesResult } from "./guild-roles-schemas.js";

const rolePosition = z.strictObject({
  id: snowflake,
  position: z.number().int().nullish(),
});

export const bulkUpdateGuildRoles = defineTool({
  name: "discord_bulk_update_guild_roles",
  description: "Modify the positions of a list of role objects for the guild",
  operationIds: ["bulk_update_guild_roles"],
  toolset: "roles",
  scope: { guild: "guild_id" },
  permissions: ["ManageRoles"],
  effect: "destructive",
  idempotent: true,
  input: z.object({
    guild_id: snowflake,
    roles: z.array(rolePosition),
    reason,
  }),
  output: rolesResult,
  execute: async ({ guild_id, roles, reason }, { discord }) => ({
    roles: await discord<RESTPatchAPIGuildRolePositionsResult>({
      method: "PATCH",
      route: Routes.guildRoles(guild_id),
      body: roles as RESTPatchAPIGuildRolePositionsJSONBody,
      reason,
    }),
  }),
});
