import {
  AutoModerationActionType,
  AutoModerationRuleEventType,
  AutoModerationRuleKeywordPresetType,
  AutoModerationRuleTriggerType,
} from "discord-api-types/v10";
import { z } from "zod/v4";
import { snowflake, user } from "../schemas.js";

export const ban = z.object({
  user,
  reason: z.string().nullish(),
});

export const autoModerationAction = z.strictObject({
  type: z
    .enum(AutoModerationActionType)
    .describe(
      "Action type: 1=BlockMessage, 2=SendAlertMessage, 3=Timeout, 4=BlockMemberInteraction",
    ),
  metadata: z
    .strictObject({
      channel_id: snowflake.optional(),
      duration_seconds: z.number().int().min(0).max(2419200).optional(),
      custom_message: z.string().max(300).nullish(),
    })
    .optional(),
});

export const autoModerationTriggerMetadata = z.strictObject({
  keyword_filter: z.array(z.string().min(1).max(60)).max(1000).optional(),
  regex_patterns: z.array(z.string().min(1).max(260)).max(10).optional(),
  presets: z
    .array(
      z
        .enum(AutoModerationRuleKeywordPresetType)
        .describe("Preset: 1=Profanity, 2=SexualContent, 3=Slurs"),
    )
    .optional(),
  allow_list: z.array(z.string().min(1).max(60)).max(1000).optional(),
  mention_total_limit: z.number().int().min(0).max(50).optional(),
  mention_raid_protection_enabled: z.boolean().optional(),
});

export const autoModerationRuleEventTypeSchema = z
  .enum(AutoModerationRuleEventType)
  .describe("Event type: 1=MessageSend, 2=MemberUpdate");

export const autoModerationRuleTriggerTypeSchema = z
  .enum(AutoModerationRuleTriggerType)
  .describe("Trigger type: 1=Keyword, 3=Spam, 4=KeywordPreset, 5=MentionSpam, 6=MemberProfile");

export const autoModerationRule = z.object({
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
});
