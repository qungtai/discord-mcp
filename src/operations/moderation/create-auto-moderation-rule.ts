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
  description: "Create an auto moderation rule for a guild",
  operationIds: ["create_auto_moderation_rule"],
  toolset: "moderation",
  scope: { guild: "guild_id" },
  permissions: ["ManageGuild"],
  effect: "write",
  // Actions can enforce moderation (timeout, block message) on members, requiring approval.
  approval: true,
  idempotent: false,
  output: z.object({
    rule: autoModerationRule,
  }),
  input: z.object({
    guild_id: snowflake,
    name: z.string().min(1).max(100),
    event_type: autoModerationRuleEventTypeSchema,
    trigger_type: autoModerationRuleTriggerTypeSchema,
    trigger_metadata: autoModerationTriggerMetadata.optional(),
    actions: z.array(autoModerationAction).min(1).max(5),
    enabled: z.boolean().optional(),
    exempt_roles: z.array(snowflake).max(20).optional(),
    exempt_channels: z.array(snowflake).max(50).optional(),
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
