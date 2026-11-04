import { type RESTPatchAPIAutoModerationRuleResult, Routes } from "discord-api-types/v10";
import { z } from "zod/v4";
import { defineTool } from "../../core/tool-registry.js";
import { reason, snowflake } from "../schemas.js";
import {
  autoModerationAction,
  autoModerationRule,
  autoModerationRuleEventTypeSchema,
  autoModerationTriggerMetadata,
} from "./schemas.js";

export const updateAutoModerationRule = defineTool({
  name: "discord_update_auto_moderation_rule",
  description:
    "Modify an existing AutoMod rule in a guild. trigger_type cannot be changed after creation. Timeout (3) works only with 1=Keyword and 5=MentionSpam. Returns the updated rule. To delete the rule permanently instead, use discord_delete_auto_moderation_rule.",
  operationIds: ["update_auto_moderation_rule"],
  toolset: "moderation",
  scope: { guild: "guild_id" },
  // ModerateMembers is required when an action has type 3 (TIMEOUT).
  permissions: ["ManageGuild", "ModerateMembers"],
  effect: "destructive",
  idempotent: true,
  output: z.object({
    rule: autoModerationRule,
  }),
  input: z.object({
    guild_id: snowflake.describe("ID of the guild"),
    rule_id: snowflake.describe("ID of the AutoMod rule to update"),
    name: z.string().min(1).max(100).optional().describe("Rule name (1-100 characters)"),
    event_type: autoModerationRuleEventTypeSchema
      .optional()
      .describe("Event context in which rule is checked: 1=MessageSend, 2=MemberUpdate"),
    trigger_metadata: autoModerationTriggerMetadata
      .optional()
      .describe("Trigger metadata defining rules and filters for matching content"),
    actions: z
      .array(autoModerationAction)
      .min(1)
      .max(5)
      .optional()
      .describe(
        "List of 1 to 5 actions to execute when the rule triggers (1=BlockMessage, 2=SendAlertMessage, 3=Timeout, 4=BlockMemberInteraction)",
      ),
    enabled: z.boolean().optional().describe("Whether the rule is enabled"),
    exempt_roles: z
      .array(snowflake)
      .max(20)
      .optional()
      .describe("Array of up to 20 role IDs exempt from this rule"),
    exempt_channels: z
      .array(snowflake)
      .max(50)
      .optional()
      .describe("Array of up to 50 channel IDs exempt from this rule"),
    reason,
  }),
  execute: async ({ guild_id, rule_id, reason, ...body }, { discord }) => ({
    rule: await discord<RESTPatchAPIAutoModerationRuleResult>({
      method: "PATCH",
      route: Routes.guildAutoModerationRule(guild_id, rule_id),
      body,
      reason,
    }),
  }),
});
