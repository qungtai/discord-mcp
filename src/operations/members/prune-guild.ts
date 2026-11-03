import { type RESTPostAPIGuildPruneResult, Routes } from "discord-api-types/v10";
import { z } from "zod/v4";
import { defineTool } from "../../core/tool-registry.js";
import { reason, snowflake } from "../schemas.js";
import { pruneCount } from "./schemas.js";

export const pruneGuild = defineTool({
  name: "discord_prune_guild",
  description: "Begin a prune operation to remove inactive members from a guild",
  operationIds: ["prune_guild"],
  toolset: "members",
  scope: { guild: "guild_id" },
  permissions: ["KickMembers"],
  effect: "destructive",
  idempotent: false,
  output: pruneCount,
  input: z.object({
    guild_id: snowflake,
    days: z.number().int().min(1).max(30).optional(),
    compute_prune_count: z.boolean().optional(),
    include_roles: z.array(snowflake).max(100).optional(),
    reason,
  }),
  execute: async ({ guild_id, reason, ...body }, { discord }) =>
    discord<RESTPostAPIGuildPruneResult>({
      method: "POST",
      route: Routes.guildPrune(guild_id),
      body,
      reason,
    }),
});
