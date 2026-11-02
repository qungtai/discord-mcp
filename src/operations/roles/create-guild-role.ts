import { type RESTPostAPIGuildRoleResult, Routes } from "discord-api-types/v10";
import { z } from "zod/v4";
import { defineTool } from "../../core/tool-registry.js";
import { reason, snowflake } from "../schemas.js";
import { roleColors, roleResult } from "./schemas.js";

export const createGuildRole = defineTool({
  name: "discord_create_guild_role",
  description: "Create a new guild role",
  operationIds: ["create_guild_role"],
  toolset: "roles",
  scope: { guild: "guild_id" },
  permissions: ["ManageRoles"],
  effect: "write",
  // Permission bits in a new role are a privilege escalation and need a prompt.
  approval: true,
  idempotent: false,
  input: z.object({
    guild_id: snowflake,
    name: z.string().min(1).max(100).optional(),
    permissions: z.string().optional(),
    color: z.number().int().min(0).max(16777215).optional(),
    colors: roleColors.optional(),
    hoist: z.boolean().optional(),
    icon: z.string().optional(),
    unicode_emoji: z.string().max(100).optional(),
    mentionable: z.boolean().optional(),
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
