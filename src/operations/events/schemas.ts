import {
  GuildScheduledEventEntityType,
  GuildScheduledEventPrivacyLevel,
  GuildScheduledEventRecurrenceRuleFrequency,
  GuildScheduledEventRecurrenceRuleMonth,
  GuildScheduledEventRecurrenceRuleWeekday,
  GuildScheduledEventStatus,
} from "discord-api-types/v10";
import { z } from "zod/v4";
import { member, snowflake, user } from "../schemas.js";

// Enums for input schemas
export const privacyLevelEnum = z.enum(GuildScheduledEventPrivacyLevel);
export const entityTypeEnum = z.enum(GuildScheduledEventEntityType);
export const statusEnum = z.enum(GuildScheduledEventStatus);

// Strict input recurrence rule schema
export const recurrenceRuleInput = z.strictObject({
  start: z.iso.datetime({ offset: true }).describe("Starting time of recurrence (ISO8601)"),
  end: z.iso
    .datetime({ offset: true })
    .nullable()
    .optional()
    .describe("Ending time of recurrence (ISO8601)"),
  frequency: z.enum(GuildScheduledEventRecurrenceRuleFrequency),
  interval: z.number().int().min(1).nullable().optional(),
  by_weekday: z
    .array(z.enum(GuildScheduledEventRecurrenceRuleWeekday))
    .max(7)
    .nullable()
    .optional(),
  by_n_weekday: z
    .array(
      z.strictObject({
        n: z.number().int().min(1).max(5),
        day: z.enum(GuildScheduledEventRecurrenceRuleWeekday),
      }),
    )
    .max(7)
    .nullable()
    .optional(),
  by_month: z.array(z.enum(GuildScheduledEventRecurrenceRuleMonth)).max(12).nullable().optional(),
  by_month_day: z.array(z.number().int().min(-1).max(31)).max(33).nullable().optional(),
  by_year_day: z.array(z.number().int().min(-1).max(365)).max(367).nullable().optional(),
  count: z.number().int().min(1).nullable().optional(),
});

// Strict input entity metadata schema
export const entityMetadataInput = z.strictObject({
  location: z.string().min(1).max(100).optional(),
});

// Shared exception input override fields
export const exceptionOverrideInput = {
  scheduled_start_time: z.iso
    .datetime({ offset: true })
    .nullable()
    .optional()
    .describe("Overridden start time (ISO8601)"),
  scheduled_end_time: z.iso
    .datetime({ offset: true })
    .nullable()
    .optional()
    .describe("Overridden end time (ISO8601)"),
  is_canceled: z.boolean().nullable().optional().describe("Whether this occurrence is canceled"),
};

// Lenient output schemas
export const entityMetadataOutput = z.object({
  location: z.string().nullish(),
});

export const recurrenceRuleOutput = z.object({
  start: z.string().optional(),
  end: z.string().nullish(),
  frequency: z.number().optional(),
  interval: z.number().nullish(),
  by_weekday: z.array(z.number()).nullish(),
  by_n_weekday: z
    .array(
      z.object({
        n: z.number().optional(),
        day: z.number().optional(),
      }),
    )
    .nullish(),
  by_month: z.array(z.number()).nullish(),
  by_month_day: z.array(z.number()).nullish(),
  by_year_day: z.array(z.number()).nullish(),
  count: z.number().nullish(),
});

export const guildScheduledEventException = z.object({
  event_id: snowflake,
  event_exception_id: snowflake,
  scheduled_start_time: z.string().nullish(),
  scheduled_end_time: z.string().nullish(),
  is_canceled: z.boolean().optional(),
});

export const guildScheduledEventUser = z.object({
  guild_scheduled_event_id: snowflake.optional(),
  user_id: snowflake.optional(),
  guild_scheduled_event_exception_id: snowflake.nullish(),
  response: z.number().optional(),
  user: user.optional(),
  member: member.optional(),
});

export const guildScheduledEvent = z.object({
  id: snowflake,
  guild_id: snowflake.optional(),
  channel_id: snowflake.nullish(),
  creator_id: snowflake.nullish(),
  name: z.string().optional(),
  description: z.string().nullish(),
  scheduled_start_time: z.string().optional(),
  scheduled_end_time: z.string().nullish(),
  privacy_level: z.number().optional(),
  status: z.number().optional(),
  entity_type: z.number().optional(),
  entity_id: snowflake.nullish(),
  entity_metadata: entityMetadataOutput.nullish(),
  creator: user.optional(),
  user_count: z.number().optional(),
  image: z.string().nullish(),
  recurrence_rule: recurrenceRuleOutput.nullish(),
  user_rsvp: guildScheduledEventUser.nullish(),
  guild_scheduled_event_exceptions: z.array(guildScheduledEventException).optional(),
});

// Shared user list query parameters
export const userListQuery = {
  limit: z.number().int().min(1).max(100).optional(),
  with_member: z.boolean().optional(),
  before: snowflake.optional(),
  after: snowflake.optional(),
};

// Shared pagination cursor computation for ascending user lists
export function userPagingCursors(users: Array<{ user?: { id: string }; user_id?: string }>) {
  const last = users.at(-1);
  const lastId = last?.user?.id ?? last?.user_id ?? null;
  return {
    users,
    next_after: lastId,
  };
}
