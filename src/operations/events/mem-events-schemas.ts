import { z } from "zod/v4";
import { member, snowflake, user } from "../schemas.js";

export const recurrenceRule = z.strictObject({
  start: z.string().describe("Starting time of the recurrence interval (ISO8601)"),
  end: z
    .string()
    .nullable()
    .optional()
    .describe("Ending time of the recurrence interval (ISO8601)"),
  frequency: z.number().int().describe("0: YEARLY, 1: MONTHLY, 2: WEEKLY, 3: DAILY"),
  interval: z.number().int().nullable().optional(),
  by_weekday: z.array(z.number().int().min(0).max(6)).nullable().optional(),
  by_n_weekday: z
    .array(
      z.strictObject({
        n: z.number().int().min(1).max(5),
        day: z.number().int().min(0).max(6),
      }),
    )
    .nullable()
    .optional(),
  by_month: z.array(z.number().int().min(1).max(12)).nullable().optional(),
  by_month_day: z.array(z.number().int().min(-1).max(31)).nullable().optional(),
  by_year_day: z.array(z.number().int().min(-1).max(365)).nullable().optional(),
  count: z.number().int().nullable().optional(),
});

export const entityMetadata = z.strictObject({
  location: z.string().max(100).optional(),
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
  entity_metadata: entityMetadata.nullish(),
  creator: user.optional(),
  user_count: z.number().optional(),
  image: z.string().nullish(),
  recurrence_rule: recurrenceRule.nullish(),
});

export type APIGuildScheduledEventData = z.input<typeof guildScheduledEvent>;

export const guildScheduledEventException = z.object({
  event_id: snowflake,
  event_exception_id: snowflake,
  scheduled_start_time: z.string().nullish(),
  scheduled_end_time: z.string().nullish(),
  is_canceled: z.boolean().optional(),
});

export type APIGuildScheduledEventExceptionData = z.input<typeof guildScheduledEventException>;

export const guildScheduledEventUser = z.object({
  guild_scheduled_event_id: snowflake,
  user: user.optional(),
  member: member.optional(),
});

export type APIGuildScheduledEventUserData = z.input<typeof guildScheduledEventUser>;
