import { type RESTGetAPIGuildPruneCountResult, Routes } from "discord-api-types/v10";
import { z } from "zod/v4";
import { defineTool } from "../../core/tool-registry.js";
import { snowflake } from "../schemas.js";
import { pruneCount } from "./schemas.js";

export const previewPruneGuild = defineTool({
  name: "discord_preview_prune_guild",
  description: "Get the number of members that would be removed in a prune operation",
  operationIds: ["preview_prune_guild"],
  toolset: "members",
  scope: { guild: "guild_id" },
  permissions: ["KickMembers"],
  effect: "read",
  idempotent: true,
  output: pruneCount,
  input: z.object({
    guild_id: snowflake,
    days: z.number().int().min(1).max(30).optional(),
    include_roles: z.string().optional(),
  }),
  execute: async ({ guild_id, ...query }, { discord }) =>
    discord<RESTGetAPIGuildPruneCountResult>({
      method: "GET",
      route: Routes.guildPrune(guild_id),
      query,
    }),
});
