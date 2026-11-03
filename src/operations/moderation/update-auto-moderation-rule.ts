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
  description: "Modify an existing auto moderation rule for a guild",
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
    guild_id: snowflake,
    rule_id: snowflake,
    name: z.string().min(1).max(100).optional(),
    event_type: autoModerationRuleEventTypeSchema.optional(),
    trigger_metadata: autoModerationTriggerMetadata.optional(),
    actions: z.array(autoModerationAction).min(1).max(5).optional(),
    enabled: z.boolean().optional(),
    exempt_roles: z.array(snowflake).max(20).optional(),
    exempt_channels: z.array(snowflake).max(50).optional(),
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
