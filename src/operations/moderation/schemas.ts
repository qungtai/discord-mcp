import {
  AutoModerationActionType,
  AutoModerationRuleEventType,
  AutoModerationRuleKeywordPresetType,
  AutoModerationRuleTriggerType,
} from "discord-api-types/v10";
import { z } from "zod/v4";
import { resource, snowflake, user } from "../schemas.js";

export const ban = resource(
  z.looseObject({
    user,
    reason: z.string().nullish(),
  }),
);

export const autoModerationAction = z.strictObject({
  type: z
    .enum(AutoModerationActionType)
    .describe(
      "Action type: 1=BlockMessage, 2=SendAlertMessage, 3=Timeout, 4=BlockMemberInteraction",
    ),
  metadata: z
    .strictObject({
      channel_id: snowflake
        .optional()
        .describe(
          "Channel ID to send alert message to (required for action type 2=SendAlertMessage)",
        ),
      duration_seconds: z
        .number()
        .int()
        .min(0)
        .max(2419200)
        .optional()
        .describe(
          "Timeout duration in seconds up to 2419200 (4 weeks, required for action type 3=Timeout)",
        ),
      custom_message: z
        .string()
        .max(300)
        .nullish()
        .describe(
          "Custom message explaining the block shown to the user (max 300 characters, for action type 1=BlockMessage)",
        ),
    })
    .optional()
    .describe("Additional configuration metadata for the action"),
});

export const autoModerationTriggerMetadata = z
  .strictObject({
    keyword_filter: z
      .array(z.string().min(1).max(60))
      .max(1000)
      .optional()
      .describe(
        "Substrings to search for in content (max 1000 items, each 1-60 characters, for trigger type 1=Keyword and 6=MemberProfile)",
      ),
    regex_patterns: z
      .array(z.string().min(1).max(260))
      .max(10)
      .optional()
      .describe(
        "Regular expression patterns (max 10 patterns, each 1-260 characters, for trigger type 1=Keyword and 6=MemberProfile)",
      ),
    presets: z
      .array(
        z
          .enum(AutoModerationRuleKeywordPresetType)
          .describe("Keyword preset: 1=Profanity, 2=SexualContent, 3=Slurs"),
      )
      .optional()
      .describe(
        "Predefined wordsets to match against content (required for trigger type 4=KeywordPreset)",
      ),
    allow_list: z
      .array(z.string().min(1).max(60))
      .max(1000)
      .optional()
      .describe(
        "Substrings or regex patterns exempt from triggering the rule (max 1000 items, each 1-60 characters)",
      ),
    mention_total_limit: z
      .number()
      .int()
      .min(0)
      .max(50)
      .optional()
      .describe(
        "Total number of unique role and user mentions allowed per message (0-50, for trigger type 5=MentionSpam)",
      ),
    mention_raid_protection_enabled: z
      .boolean()
      .optional()
      .describe("Whether to enable mention raid protection (for trigger type 5=MentionSpam)"),
  })
  .describe("Trigger metadata defining rules and filters for matching content");

export const autoModerationRuleEventTypeSchema = z
  .enum(AutoModerationRuleEventType)
  .describe("Event type: 1=MessageSend, 2=MemberUpdate");

export const autoModerationRuleTriggerTypeSchema = z
  .enum(AutoModerationRuleTriggerType)
  .describe("Trigger type: 1=Keyword, 3=Spam, 4=KeywordPreset, 5=MentionSpam, 6=MemberProfile");

export const autoModerationRule = resource(
  z.looseObject({
    id: snowflake,
    guild_id: snowflake,
    name: z.string().optional(),
    creator_id: snowflake.optional(),
    event_type: z.number().int().optional(),
    trigger_type: z.number().int().optional(),
    trigger_metadata: z.unknown().optional(),
    actions: z.array(z.unknown()).optional(),
    enabled: z.boolean().optional(),
    exempt_roles: z.array(snowflake).optional(),
    exempt_channels: z.array(snowflake).optional(),
  }),
);
