import { type RESTPatchAPIGuildRoleResult, Routes } from "discord-api-types/v10";
import { z } from "zod/v4";
import { defineTool } from "../../core/tool-registry.js";
import { permissionBits, reason, snowflake } from "../schemas.js";
import { roleColors, roleResult } from "./schemas.js";

export const updateGuildRole = defineTool({
  name: "discord_update_guild_role",
  description:
    "Update settings, name, permissions bitfield, color, hoist, and icon for an existing guild role. Under Discord role hierarchy rules, the bot can only modify roles positioned strictly below its highest role and cannot grant permissions it does not possess. To modify role ordering instead use discord_bulk_update_guild_roles. Returns the updated role object.",
  operationIds: ["update_guild_role"],
  toolset: "roles",
  scope: { guild: "guild_id" },
  permissions: ["ManageRoles"],
  effect: "destructive",
  idempotent: true,
  input: z.object({
    guild_id: snowflake.describe("ID of the guild that owns the role (numeric snowflake string)"),
    role_id: snowflake.describe("ID of the role to update (numeric snowflake string)"),
    name: z
      .string()
      .min(1)
      .max(100)
      .nullish()
      .describe("New role name (1-100 characters), or null"),
    permissions: permissionBits
      .nullish()
      .describe(
        "New permission bitfield decimal string granted to this role (cannot exceed bot own permissions), or null",
      ),
    color: z
      .number()
      .int()
      .min(0)
      .max(16777215)
      .nullish()
      .describe("RGB color integer between 0 and 16777215, or null to reset to default color"),
    colors: roleColors
      .nullish()
      .describe(
        "Extended color gradient object for primary, secondary, and tertiary colors, or null",
      ),
    hoist: z
      .boolean()
      .nullish()
      .describe("Whether this role is displayed separately in the member list, or null"),
    icon: z
      .string()
      .nullish()
      .describe(
        "Base64 image data URI for the role icon, or null to clear (needs the ROLE_ICONS feature)",
      ),
    unicode_emoji: z
      .string()
      .max(100)
      .nullish()
      .describe(
        "Standard unicode emoji character for the role icon, or null to clear (requires ROLE_ICONS feature)",
      ),
    mentionable: z
      .boolean()
      .nullish()
      .describe("Whether this role can be mentioned by anyone in chat messages, or null"),
    reason,
  }),
  output: roleResult,
  execute: async ({ guild_id, role_id, reason, ...body }, { discord }) => ({
    role: await discord<RESTPatchAPIGuildRoleResult>({
      method: "PATCH",
      route: Routes.guildRole(guild_id, role_id),
      body,
      reason,
    }),
  }),
});
