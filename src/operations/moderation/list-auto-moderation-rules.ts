import { type RESTGetAPIAutoModerationRulesResult, Routes } from "discord-api-types/v10";
import { z } from "zod/v4";
import { defineTool } from "../../core/tool-registry.js";
import { snowflake } from "../schemas.js";
import { autoModerationRule } from "./schemas.js";

export const listAutoModerationRules = defineTool({
  name: "discord_list_auto_moderation_rules",
  description:
    "List all AutoMod rules configured in a guild, including triggers, actions and exemptions. Returns an array of rule objects. To view a specific rule by ID, use discord_get_auto_moderation_rule. To create a new rule, use discord_create_auto_moderation_rule.",
  operationIds: ["list_auto_moderation_rules"],
  toolset: "moderation",
  scope: { guild: "guild_id" },
  permissions: ["ManageGuild"],
  effect: "read",
  idempotent: true,
  output: z.object({
    rules: z.array(autoModerationRule),
  }),
  input: z.object({
    guild_id: snowflake.describe("ID of the guild"),
  }),
  execute: async ({ guild_id }, { discord }) => ({
    rules: await discord<RESTGetAPIAutoModerationRulesResult>({
      method: "GET",
      route: Routes.guildAutoModerationRules(guild_id),
    }),
  }),
});
