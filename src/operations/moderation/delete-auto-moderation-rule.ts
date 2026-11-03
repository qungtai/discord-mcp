import { type RESTDeleteAPIAutoModerationRuleResult, Routes } from "discord-api-types/v10";
import { z } from "zod/v4";
import { defineTool } from "../../core/tool-registry.js";
import { reason, snowflake } from "../schemas.js";

export const deleteAutoModerationRule = defineTool({
  name: "discord_delete_auto_moderation_rule",
  description: "Delete an auto moderation rule for a guild",
  operationIds: ["delete_auto_moderation_rule"],
  toolset: "moderation",
  scope: { guild: "guild_id" },
  permissions: ["ManageGuild"],
  effect: "destructive",
  idempotent: true,
  output: z.object({
    deleted: z.literal(true),
    guild_id: snowflake,
    rule_id: snowflake,
  }),
  input: z.object({
    guild_id: snowflake,
    rule_id: snowflake,
    reason,
  }),
  execute: async ({ guild_id, rule_id, reason }, { discord }) => {
    await discord<RESTDeleteAPIAutoModerationRuleResult>({
      method: "DELETE",
      route: Routes.guildAutoModerationRule(guild_id, rule_id),
      reason,
    });
    return {
      deleted: true as const,
      guild_id,
      rule_id,
    };
  },
});
