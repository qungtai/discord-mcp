import { type RESTPatchAPIGuildScheduledEventResult, Routes } from "discord-api-types/v10";
import { z } from "zod/v4";
import { defineTool } from "../../core/tool-registry.js";
import { reason, snowflake } from "../schemas.js";
import {
  entityMetadataInput,
  entityTypeEnum,
  guildScheduledEvent,
  privacyLevelEnum,
  recurrenceRuleInput,
  statusEnum,
} from "./schemas.js";

// Note on channel_id:
// Discord accepts channel_id: null when transitioning an event to EXTERNAL (entity_type: 3).
// However, the core scope validator (scopeIds in src/core/tool-registry.ts) strictly requires all
// scoped values to be string | string[] (throwing internal error on null).
// Until scopeIds is updated in core to skip null, channel_id is optional snowflake here.
export const updateGuildScheduledEvent = defineTool({
  name: "discord_update_guild_scheduled_event",
  description: "Modify a guild scheduled event",
  operationIds: ["update_guild_scheduled_event"],
  toolset: "events",
  scope: {
    guild: "guild_id",
    channel: "channel_id",
  },
  permissions: ["ManageEvents"],
  effect: "destructive",
  idempotent: true,
  input: z.object({
    guild_id: snowflake,
    guild_scheduled_event_id: snowflake,
    channel_id: snowflake.nullable().optional(),
    entity_metadata: entityMetadataInput.nullable().optional(),
    name: z.string().min(1).max(100).optional(),
    privacy_level: privacyLevelEnum.optional(),
    scheduled_start_time: z.iso.datetime({ offset: true }).optional().describe("ISO8601 timestamp"),
    scheduled_end_time: z.iso
      .datetime({ offset: true })
      .nullable()
      .optional()
      .describe("ISO8601 timestamp"),
    description: z.string().max(1000).nullable().optional(),
    entity_type: entityTypeEnum
      .nullable()
      .optional()
      .describe("1: STAGE_INSTANCE, 2: VOICE, 3: EXTERNAL"),
    image: z.string().nullable().optional().describe("Base64 1024x1024 jpeg/png/gif image data"),
    status: statusEnum
      .nullable()
      .optional()
      .describe("1: SCHEDULED, 2: ACTIVE, 3: COMPLETED, 4: CANCELED"),
    recurrence_rule: recurrenceRuleInput.nullable().optional(),
    reason,
  }),
  output: z.object({
    guild_scheduled_event: guildScheduledEvent,
  }),
  execute: async (
    { guild_id, guild_scheduled_event_id, reason: auditReason, ...body },
    { discord },
  ) => ({
    guild_scheduled_event: await discord<RESTPatchAPIGuildScheduledEventResult>({
      method: "PATCH",
      route: Routes.guildScheduledEvent(guild_id, guild_scheduled_event_id),
      body,
      reason: auditReason,
    }),
  }),
});
