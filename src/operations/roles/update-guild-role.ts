import { type RESTPatchAPIGuildRoleResult, Routes } from "discord-api-types/v10";
import { z } from "zod/v4";
import { defineTool } from "../../core/tool-registry.js";
import { reason, snowflake } from "../schemas.js";
import { roleColors, roleResult } from "./schemas.js";

export const updateGuildRole = defineTool({
  name: "discord_update_guild_role",
  description: "Update a guild role",
  operationIds: ["update_guild_role"],
  toolset: "roles",
  scope: { guild: "guild_id" },
  permissions: ["ManageRoles"],
  effect: "destructive",
  idempotent: true,
  input: z.object({
    guild_id: snowflake,
    role_id: snowflake,
    name: z.string().min(1).max(100).nullish(),
    permissions: z.string().nullish(),
    color: z.number().int().min(0).max(16777215).nullish(),
    colors: roleColors.nullish(),
    hoist: z.boolean().nullish(),
    icon: z.string().nullish(),
    unicode_emoji: z.string().max(100).nullish(),
    mentionable: z.boolean().nullish(),
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
