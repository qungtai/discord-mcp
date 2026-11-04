import { type RESTPatchAPIGuildRolePositionsResult, Routes } from "discord-api-types/v10";
import { z } from "zod/v4";
import { defineTool } from "../../core/tool-registry.js";
import { reason, snowflake } from "../schemas.js";
import { rolesResult } from "./schemas.js";

const rolePosition = z.strictObject({
  id: snowflake.describe("Role snowflake ID to position"),
  position: z
    .number()
    .int()
    .nullish()
    .describe(
      "Target zero-indexed position for this role (must be strictly lower than the bot highest role)",
    ),
});

export const bulkUpdateGuildRoles = defineTool({
  name: "discord_bulk_update_guild_roles",
  description:
    "Batch update sorting positions for multiple guild roles. Discord reorders positions from 0 upwards; swapping or moving positions shifts intervening roles. Under Discord role hierarchy rules, the bot can only modify positions of roles strictly below its highest role. To inspect current role order use discord_list_guild_roles. Returns the updated list of all guild roles.",
  operationIds: ["bulk_update_guild_roles"],
  toolset: "roles",
  scope: { guild: "guild_id" },
  permissions: ["ManageRoles"],
  effect: "destructive",
  idempotent: true,
  input: z.object({
    guild_id: snowflake.describe(
      "ID of the guild whose role positions to reorder (numeric snowflake string)",
    ),
    roles: z
      .array(rolePosition)
      .describe(
        "Array of role position update objects specifying role ID and target integer position",
      ),
    reason,
  }),
  output: rolesResult,
  execute: async ({ guild_id, roles, reason }, { discord }) => ({
    roles: await discord<RESTPatchAPIGuildRolePositionsResult>({
      method: "PATCH",
      route: Routes.guildRoles(guild_id),
      body: roles,
      reason,
    }),
  }),
});
