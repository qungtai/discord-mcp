import { z } from "zod/v4";
import { snowflake, user } from "../schemas.js";

export const ban = z.object({
  user,
  reason: z.string().nullish(),
});

export const autoModerationAction = z.strictObject({
  type: z.number().int(),
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
  presets: z.array(z.number().int()).optional(),
  allow_list: z.array(z.string().min(1).max(60)).max(1000).optional(),
  mention_total_limit: z.number().int().min(0).max(50).optional(),
  mention_raid_protection_enabled: z.boolean().optional(),
});

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
