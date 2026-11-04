import { type RESTPostAPIGuildScheduledEventResult, Routes } from "discord-api-types/v10";
import { z } from "zod/v4";
import { defineTool } from "../../core/tool-registry.js";
import { reason, snowflake } from "../schemas.js";
import {
  entityMetadataInput,
  entityTypeEnum,
  guildScheduledEvent,
  privacyLevelEnum,
  recurrenceRuleInput,
} from "./schemas.js";

export const createGuildScheduledEvent = defineTool({
  name: "discord_create_guild_scheduled_event",
  description:
    "Create a new scheduled event in a guild for a Stage channel (1=StageInstance), Voice channel (2=Voice) or external venue (3=External, requiring entity_metadata.location and scheduled_end_time). Privacy level is 2=GuildOnly. Returns the created scheduled event. To view events in the guild, use discord_list_guild_scheduled_events.",
  operationIds: ["create_guild_scheduled_event"],
  toolset: "events",
  scope: {
    guild: "guild_id",
    channel: "channel_id",
  },
  permissions: ["ManageEvents", "CreateEvents"],
  effect: "write",
  idempotent: false,
  input: z.object({
    guild_id: snowflake.describe("ID of the guild"),
    channel_id: snowflake
      .optional()
      .describe(
        "Channel ID where the event will be hosted (required for entity_type 1=StageInstance and 2=Voice; omitted for 3=External)",
      ),
    entity_metadata: entityMetadataInput
      .optional()
      .describe("Additional entity metadata (physical or virtual location for external events)"),
    name: z.string().min(1).max(100).describe("Event name (1-100 characters)"),
    privacy_level: privacyLevelEnum,
    scheduled_start_time: z.iso
      .datetime({ offset: true })
      .describe(
        "Start time of the scheduled event: ISO 8601 date and time with seconds, for example 2026-11-05T18:00:00Z",
      ),
    scheduled_end_time: z.iso
      .datetime({ offset: true })
      .optional()
      .describe(
        "End time: ISO 8601 date and time with seconds, for example 2026-11-05T18:00:00Z (required for entity_type 3=External; optional for voice/stage)",
      ),
    description: z
      .string()
      .max(1000)
      .optional()
      .describe("Description of the scheduled event (max 1000 characters)"),
    entity_type: entityTypeEnum,
    image: z
      .string()
      .optional()
      .describe(
        "Cover image as a data URI, for example data:image/png;base64,AAAA; JPEG, PNG or GIF",
      ),
    recurrence_rule: recurrenceRuleInput
      .optional()
      .describe(
        "Recurrence rule. Discord supports only simple rules: daily with a fixed weekday set, weekly on one weekday (interval 1 or 2), monthly on one by_n_weekday, or yearly with one by_month and one by_month_day. by_weekday, by_n_weekday and by_month with by_month_day cannot be mixed",
      ),
    reason,
  }),
  output: z.object({
    guild_scheduled_event: guildScheduledEvent,
  }),
  execute: async ({ guild_id, reason: auditReason, ...body }, { discord }) => ({
    guild_scheduled_event: await discord<RESTPostAPIGuildScheduledEventResult>({
      method: "POST",
      route: Routes.guildScheduledEvents(guild_id),
      body,
      reason: auditReason,
    }),
  }),
});
