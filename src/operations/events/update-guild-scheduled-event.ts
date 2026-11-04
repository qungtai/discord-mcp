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
    "Modify an existing guild scheduled event. Status moves only from 1=Scheduled to 2=Active or 4=Canceled, and from 2=Active to 3=Completed. Returns the updated scheduled event. To permanently remove an event, use discord_delete_guild_scheduled_event.",
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
      .describe(
        "Entity type: 1=StageInstance, 2=Voice, 3=External; when changing to 3=External, channel_id must be null and entity_metadata.location and scheduled_end_time are required",
      ),
    image: z
      .string()
      .nullable()
      .optional()
      .describe(
        "New cover image as a data URI, for example data:image/png;base64,AAAA, or null to remove it",
      ),
    status: statusEnum
      .nullable()
      .optional()
      .describe(
        "Status: 2=Active starts a scheduled event, 3=Completed ends an active one, 4=Canceled cancels one that is still scheduled; completed and canceled events cannot change status",
      ),
    recurrence_rule: recurrenceRuleInput
      .nullable()
      .optional()
      .describe(
        "Recurrence rule. Discord supports only simple rules: daily with a fixed weekday set, weekly on one weekday (interval 1 or 2), monthly on one by_n_weekday, or yearly with one by_month and one by_month_day. by_weekday, by_n_weekday and by_month with by_month_day cannot be mixed, or null to remove recurrence",
      ),
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
