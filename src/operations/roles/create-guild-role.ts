import { type RESTPostAPIGuildRoleResult, Routes } from "discord-api-types/v10";
import { z } from "zod/v4";
import { defineTool } from "../../core/tool-registry.js";
import { permissionBits, reason, snowflake } from "../schemas.js";
import { roleColors, roleResult } from "./schemas.js";

export const createGuildRole = defineTool({
  name: "discord_create_guild_role",
  description:
    "Create a new role in a guild with customized name, permissions bitfield, color, hoist, and icon settings. Under role hierarchy rules, the bot can only grant permissions it currently holds. Newly created roles are placed just above the @everyone role. To list existing roles use discord_list_guild_roles. Returns the created role object.",
  operationIds: ["create_guild_role"],
  toolset: "roles",
  scope: { guild: "guild_id" },
  permissions: ["ManageRoles"],
  effect: "write",
  // Permission bits in a new role are a privilege escalation and need a prompt.
  approval: true,
  idempotent: false,
  input: z.object({
    guild_id: snowflake.describe(
      "ID of the guild where the role will be created (numeric snowflake string)",
    ),
    name: z
      .string()
      .min(1)
      .max(100)
      .optional()
      .describe("Name of the role (1-100 characters, defaults to 'new role')"),
    permissions: permissionBits
      .optional()
      .describe(
        "Permission bitfield decimal string granted to this role (cannot exceed bot own permissions)",
      ),
    color: z
      .number()
      .int()
      .min(0)
      .max(16777215)
      .optional()
      .describe("RGB color integer between 0 and 16777215 (e.g. 0x5865F2, defaults to 0)"),
    colors: roleColors
      .optional()
      .describe("Extended color gradient object for primary, secondary, and tertiary colors"),
    hoist: z
      .boolean()
      .optional()
      .describe(
        "Whether this role is displayed separately in the member sidebar (defaults to false)",
      ),
    icon: z
      .string()
      .optional()
      .describe("Base64 128x128 image data URI for the role icon (requires ROLE_ICONS feature)"),
    unicode_emoji: z
      .string()
      .max(100)
      .optional()
      .describe("Standard unicode emoji character for the role icon (requires ROLE_ICONS feature)"),
    mentionable: z
      .boolean()
      .optional()
      .describe("Whether anyone can mention this role in chat messages (defaults to false)"),
    reason,
  }),
  output: roleResult,
  execute: async ({ guild_id, reason, ...body }, { discord }) => ({
    role: await discord<RESTPostAPIGuildRoleResult>({
      method: "POST",
      route: Routes.guildRoles(guild_id),
      body,
      reason,
    }),
  }),
});
