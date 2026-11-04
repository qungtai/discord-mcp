import { type RESTPatchAPIGuildRolePositionsResult, Routes } from "discord-api-types/v10";
import { z } from "zod/v4";
import { defineTool } from "../../core/tool-registry.js";
import { reason, snowflake } from "../schemas.js";
import { rolesResult } from "./schemas.js";

const rolePosition = z
  .strictObject({
    id: snowflake.describe("Role snowflake ID to position"),
    position: z
      .number()
      .int()
      .nullish()
      .describe("Position to move the role to (an integer below the bot's highest role)"),
  })
  .describe("One role and the position to move it to");

export const bulkUpdateGuildRoles = defineTool({
  name: "discord_bulk_update_guild_roles",
  description:
    "Change the position of several roles in one call. Send only the roles to move; Discord shifts the others to make room. A higher position ranks higher in the hierarchy, and @everyone stays at position 0. The bot can only reorder roles below its own highest role. To see the current order use discord_list_guild_roles. Returns every role in the guild.",
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
