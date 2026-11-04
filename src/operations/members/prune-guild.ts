import { type RESTPostAPIGuildPruneResult, Routes } from "discord-api-types/v10";
import { z } from "zod/v4";
import { defineTool } from "../../core/tool-registry.js";
import { reason, snowflake } from "../schemas.js";
import { pruneCount } from "./schemas.js";

export const pruneGuild = defineTool({
  name: "discord_prune_guild",
  description:
    "Prune inactive members from a guild. Always run discord_preview_prune_guild first to check how many members will be kicked. A member with a role outside include_roles is never pruned. Returns the number of pruned members when compute_prune_count is true.",
  operationIds: ["prune_guild"],
  toolset: "members",
  scope: { guild: "guild_id" },
  permissions: ["KickMembers", "ManageGuild"],
  effect: "destructive",
  idempotent: false,
  output: pruneCount,
  input: z.object({
    guild_id: snowflake.describe("ID of the guild"),
    days: z
      .number()
      .int()
      .min(1)
      .max(30)
      .optional()
      .describe("Number of days of inactivity to prune members for (1-30, default 7)"),
    compute_prune_count: z
      .boolean()
      .optional()
      .describe(
        "Whether to compute and return the number of pruned members; defaults to true, false returns null pruned count",
      ),
    include_roles: z
      .array(snowflake)
      .max(100)
      .optional()
      .describe(
        "Role IDs to include in the prune; by default only members without any roles are pruned",
      ),
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
