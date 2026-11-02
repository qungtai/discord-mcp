import { type RESTGetAPIAutoModerationRuleResult, Routes } from "discord-api-types/v10";
import { z } from "zod/v4";
import { defineTool } from "../../core/tool-registry.js";
import { snowflake } from "../schemas.js";
import { autoModerationRule } from "./mem-moderation-schemas.js";

export const getAutoModerationRule = defineTool({
  name: "discord_get_auto_moderation_rule",
  description: "Get a specific auto moderation rule for a guild",
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
    guild_id: snowflake,
    rule_id: snowflake,
  }),
  execute: async ({ guild_id, rule_id }, { discord }) => ({
    rule: await discord<RESTGetAPIAutoModerationRuleResult>({
      method: "GET",
      route: Routes.guildAutoModerationRule(guild_id, rule_id),
    }),
  }),
});
