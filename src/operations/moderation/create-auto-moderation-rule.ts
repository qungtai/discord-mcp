import { type RESTPostAPIAutoModerationRuleResult, Routes } from "discord-api-types/v10";
import { z } from "zod/v4";
import { defineTool } from "../../core/tool-registry.js";
import { reason, snowflake } from "../schemas.js";
import {
  autoModerationAction,
  autoModerationRule,
  autoModerationRuleEventTypeSchema,
  autoModerationRuleTriggerTypeSchema,
  autoModerationTriggerMetadata,
} from "./schemas.js";

export const createAutoModerationRule = defineTool({
  name: "discord_create_auto_moderation_rule",
  description:
    "Create an AutoMod rule in a guild. Rules per guild: 6 keyword rules, 1 each of the other trigger types. trigger_type cannot be changed after creation. Timeout (3) works only with 1=Keyword and 5=MentionSpam. Returns the created rule. To view existing AutoMod rules for a guild, use discord_list_auto_moderation_rules.",
  operationIds: ["create_auto_moderation_rule"],
  toolset: "moderation",
  scope: { guild: "guild_id" },
  // ModerateMembers is required when an action has type 3 (TIMEOUT).
  permissions: ["ManageGuild", "ModerateMembers"],
  effect: "write",
  // Actions can enforce moderation (timeout, block message) on members, requiring approval.
  approval: true,
  idempotent: false,
  output: z.object({
    rule: autoModerationRule,
  }),
  input: z.object({
    guild_id: snowflake.describe("ID of the guild"),
    name: z.string().min(1).max(100).describe("Rule name (1-100 characters)"),
    event_type: autoModerationRuleEventTypeSchema,
    trigger_type: autoModerationRuleTriggerTypeSchema,
    trigger_metadata: autoModerationTriggerMetadata
      .optional()
      .describe("Trigger metadata defining rules and filters for matching content"),
    actions: z
      .array(autoModerationAction)
      .min(1)
      .max(5)
      .describe(
        "List of 1 to 5 actions to execute when the rule triggers (1=BlockMessage, 2=SendAlertMessage, 3=Timeout, 4=BlockMemberInteraction)",
      ),
    enabled: z
      .boolean()
      .optional()
      .describe("Whether the rule is initially enabled; defaults to false"),
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
  execute: async ({ guild_id, reason, ...body }, { discord }) => ({
    rule: await discord<RESTPostAPIAutoModerationRuleResult>({
      method: "POST",
      route: Routes.guildAutoModerationRules(guild_id),
      body,
      reason,
    }),
  }),
});
