import { Routes } from "discord-api-types/v10";
import { z } from "zod/v4";
import { defineTool } from "../../core/tool-registry.js";
import { reason, snowflake } from "../schemas.js";
import {
  type APIGuildScheduledEventData,
  entityMetadata,
  guildScheduledEvent,
  recurrenceRule,
} from "./mem-events-schemas.js";

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
    entity_metadata: entityMetadata.nullable().optional(),
    name: z.string().min(1).max(100).optional(),
    privacy_level: z.number().int().optional(),
    scheduled_start_time: z.string().optional().describe("ISO8601 timestamp"),
    scheduled_end_time: z.string().nullable().optional().describe("ISO8601 timestamp"),
    description: z.string().max(1000).nullable().optional(),
    entity_type: z
      .number()
      .int()
      .nullable()
      .optional()
      .describe("1: STAGE_INSTANCE, 2: VOICE, 3: EXTERNAL"),
    image: z.string().nullable().optional().describe("Base64 1024x1024 jpeg/png/gif image data"),
    status: z
      .number()
      .int()
      .nullable()
      .optional()
      .describe("1: SCHEDULED, 2: ACTIVE, 3: COMPLETED, 4: CANCELED"),
    recurrence_rule: recurrenceRule.nullable().optional(),
    reason,
  }),
  output: z.object({
    guild_scheduled_event: guildScheduledEvent,
  }),
  execute: async (
    { guild_id, guild_scheduled_event_id, reason: auditReason, ...body },
    { discord },
  ) => {
    const event = await discord<APIGuildScheduledEventData>({
      method: "PATCH",
      route: Routes.guildScheduledEvent(guild_id, guild_scheduled_event_id),
      body,
      reason: auditReason,
    });
    return { guild_scheduled_event: event };
  },
});
