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

export const updateGuildScheduledEvent = defineTool({
  name: "discord_update_guild_scheduled_event",
  description:
    "Modify an existing guild scheduled event, including channel, timing, entity type (1=StageInstance, 2=Voice, 3=External), status (1=Scheduled, 2=Active, 3=Completed, 4=Canceled) and recurrence rule. Returns the updated scheduled event. To permanently remove an event, use discord_delete_guild_scheduled_event.",
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
    guild_id: snowflake.describe("ID of the guild"),
    guild_scheduled_event_id: snowflake.describe("ID of the scheduled event to update"),
    channel_id: snowflake
      .nullable()
      .optional()
      .describe(
        "Voice or stage channel ID where event is hosted, or null for external events (entity_type 3=External)",
      ),
    entity_metadata: entityMetadataInput
      .nullable()
      .optional()
      .describe(
        "Additional entity metadata (physical or virtual location for external events), or null to clear",
      ),
    name: z.string().min(1).max(100).optional().describe("Event name (1-100 characters)"),
    privacy_level: privacyLevelEnum
      .optional()
      .describe("Privacy level of the scheduled event (2=GuildOnly)"),
    scheduled_start_time: z.iso
      .datetime({ offset: true })
      .optional()
      .describe("Start time of the scheduled event in ISO 8601 format"),
    scheduled_end_time: z.iso
      .datetime({ offset: true })
      .nullable()
      .optional()
      .describe(
        "End time in ISO 8601 format (required for entity_type 3=External; optional for voice/stage)",
      ),
    description: z
      .string()
      .max(1000)
      .nullable()
      .optional()
      .describe("Description of the scheduled event (max 1000 characters)"),
    entity_type: entityTypeEnum
      .nullable()
      .optional()
      .describe("Entity type of the scheduled event: 1=StageInstance, 2=Voice, 3=External"),
    image: z
      .string()
      .nullable()
      .optional()
      .describe(
        "Base64 encoded 1024x1024 JPEG/PNG/GIF image data for the event banner, or null to remove",
      ),
    status: statusEnum
      .nullable()
      .optional()
      .describe("Status of the scheduled event: 1=Scheduled, 2=Active, 3=Completed, 4=Canceled"),
    recurrence_rule: recurrenceRuleInput
      .nullable()
      .optional()
      .describe("Recurrence rule definition for recurring events, or null to remove recurrence"),
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
