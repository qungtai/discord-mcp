import { type RESTGetAPIAutoModerationRuleResult, Routes } from "discord-api-types/v10";
import { z } from "zod/v4";
import { defineTool } from "../../core/tool-registry.js";
import { snowflake } from "../schemas.js";
import { autoModerationRule } from "./schemas.js";

export const getAutoModerationRule = defineTool({
  name: "discord_get_auto_moderation_rule",
  description:
    "Fetch a single AutoMod rule by ID from a guild, including trigger configuration, actions and exempt filters. Use it when you already know the rule ID; to view all configured AutoMod rules in a guild, use discord_list_auto_moderation_rules.",
  operationIds: ["get_auto_moderation_rule"],
  toolset: "moderation",
  scope: { guild: "guild_id" },
  permissions: ["ManageGuild"],
  effect: "read",
  idempotent: true,
  output: z.object({
    rule: autoModerationRule,
  }),
  input: z.object({
    guild_id: snowflake.describe("ID of the guild"),
    rule_id: snowflake.describe("ID of the AutoMod rule to fetch"),
  }),
  execute: async ({ guild_id, rule_id }, { discord }) => ({
    rule: await discord<RESTGetAPIAutoModerationRuleResult>({
      method: "GET",
      route: Routes.guildAutoModerationRule(guild_id, rule_id),
    }),
  }),
});
