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

export const createGuildScheduledEvent = defineTool({
  name: "discord_create_guild_scheduled_event",
  description: "Create a scheduled event for a guild",
  operationIds: ["create_guild_scheduled_event"],
  toolset: "events",
  scope: {
    guild: "guild_id",
    channel: "channel_id",
  },
  permissions: ["ManageEvents"],
  effect: "write",
  idempotent: false,
  input: z.object({
    guild_id: snowflake,
    channel_id: snowflake.optional(),
    entity_metadata: entityMetadata.optional(),
    name: z.string().min(1).max(100),
    privacy_level: z.number().int(),
    scheduled_start_time: z.string().describe("ISO8601 timestamp"),
    scheduled_end_time: z.string().optional().describe("ISO8601 timestamp"),
    description: z.string().max(1000).optional(),
    entity_type: z.number().int().describe("1: STAGE_INSTANCE, 2: VOICE, 3: EXTERNAL"),
    image: z.string().optional().describe("Base64 1024x1024 jpeg/png/gif image data"),
    recurrence_rule: recurrenceRule.optional(),
    reason,
  }),
  output: z.object({
    guild_scheduled_event: guildScheduledEvent,
  }),
  execute: async ({ guild_id, reason: auditReason, ...body }, { discord }) => {
    const event = await discord<APIGuildScheduledEventData>({
      method: "POST",
      route: Routes.guildScheduledEvents(guild_id),
      body,
      reason: auditReason,
    });
    return { guild_scheduled_event: event };
  },
});
