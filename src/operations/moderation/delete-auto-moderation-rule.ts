import { type RESTDeleteAPIAutoModerationRuleResult, Routes } from "discord-api-types/v10";
import { z } from "zod/v4";
import { defineTool } from "../../core/tool-registry.js";
import { reason, snowflake } from "../schemas.js";

export const deleteAutoModerationRule = defineTool({
  name: "discord_delete_auto_moderation_rule",
  description:
    "Permanently delete an AutoMod rule from a guild. To disable a rule without deleting it, use discord_update_auto_moderation_rule with enabled=false. To list remaining AutoMod rules, use discord_list_auto_moderation_rules.",
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
    guild_id: snowflake.describe("ID of the guild"),
    rule_id: snowflake.describe("ID of the AutoMod rule to delete"),
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
