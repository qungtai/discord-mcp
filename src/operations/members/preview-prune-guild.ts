import { type RESTGetAPIGuildPruneCountResult, Routes } from "discord-api-types/v10";
import { z } from "zod/v4";
import { defineTool } from "../../core/tool-registry.js";
import { snowflake } from "../schemas.js";
import { pruneCount } from "./schemas.js";

export const previewPruneGuild = defineTool({
  name: "discord_preview_prune_guild",
  description:
    "Preview the number of inactive members that would be kicked in a prune operation before executing it. Always run this tool before discord_prune_guild to verify the impact. A member with a role outside include_roles is never pruned.",
  operationIds: ["preview_prune_guild"],
  toolset: "members",
  scope: { guild: "guild_id" },
  permissions: ["KickMembers", "ManageGuild"],
  effect: "read",
  idempotent: true,
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
    include_roles: z
      .array(snowflake)
      .max(100)
      .optional()
      .describe(
        "Role IDs to include in the prune check; by default only members with no roles are pruned",
      ),
  }),
  execute: async ({ guild_id, ...query }, { discord }) =>
    discord<RESTGetAPIGuildPruneCountResult>({
      method: "GET",
      route: Routes.guildPrune(guild_id),
      query,
    }),
});
