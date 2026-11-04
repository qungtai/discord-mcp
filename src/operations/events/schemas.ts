import {
  GuildScheduledEventEntityType,
  GuildScheduledEventPrivacyLevel,
  GuildScheduledEventRecurrenceRuleFrequency,
  GuildScheduledEventRecurrenceRuleMonth,
  GuildScheduledEventRecurrenceRuleWeekday,
  GuildScheduledEventStatus,
} from "discord-api-types/v10";
import { z } from "zod/v4";
import { member, resource, snowflake, user } from "../schemas.js";

// Enums for input schemas
export const privacyLevelEnum = z
  .enum(GuildScheduledEventPrivacyLevel)
  .describe("Privacy level: 2=GuildOnly");
export const entityTypeEnum = z
  .enum(GuildScheduledEventEntityType)
  .describe("Entity type: 1=StageInstance, 2=Voice, 3=External");
export const statusEnum = z
  .enum(GuildScheduledEventStatus)
  .describe(
    "Status: 2=Active starts a scheduled event, 3=Completed ends an active one, 4=Canceled cancels one that is still scheduled; completed and canceled events cannot change status",
  );

// Strict input recurrence rule schema
export const recurrenceRuleInput = z
  .strictObject({
    start: z.iso.datetime({ offset: true }).describe("Starting time of recurrence (ISO 8601)"),
    end: z.iso
      .datetime({ offset: true })
      .nullable()
      .optional()
      .describe(
        "Not settable through the API at present; Discord rejects or ignores it, so omit it",
      ),
    frequency: z
      .enum(GuildScheduledEventRecurrenceRuleFrequency)
      .describe("Frequency: 0=Yearly, 1=Monthly, 2=Weekly, 3=Daily"),
    interval: z
      .number()
      .int()
      .min(1)
      .nullable()
      .optional()
      .describe(
        "Spacing between occurrences; Discord accepts a value other than 1 only for weekly (2=Weekly) rules, where 2 means every other week",
      ),
    by_weekday: z
      .array(z.enum(GuildScheduledEventRecurrenceRuleWeekday))
      .max(7)
      .nullable()
      .optional()
      .describe(
        "Days of the week on which recurrence occurs: 0=Monday, 1=Tuesday, 2=Wednesday, 3=Thursday, 4=Friday, 5=Saturday, 6=Sunday",
      ),
    by_n_weekday: z
      .array(
        z
          .strictObject({
            n: z
              .number()
              .int()
              .min(1)
              .max(5)
              .describe(
                "The week index of the month: 1=first, 2=second, 3=third, 4=fourth, 5=fifth",
              ),
            day: z
              .enum(GuildScheduledEventRecurrenceRuleWeekday)
              .describe(
                "Day of the week: 0=Monday, 1=Tuesday, 2=Wednesday, 3=Thursday, 4=Friday, 5=Saturday, 6=Sunday",
              ),
          })
          .describe(
            "One week-of-month and weekday pair, for example n=4, day=2 for the fourth Wednesday",
          ),
      )
      .max(7)
      .nullable()
      .optional()
      .describe("Specific weeks and weekdays of the month on which recurrence occurs"),
    by_month: z
      .array(z.enum(GuildScheduledEventRecurrenceRuleMonth))
      .max(12)
      .nullable()
      .optional()
      .describe("Months of the year on which recurrence occurs (1=January through 12=December)"),
    by_month_day: z
      .array(z.number().int().min(-1).max(31))
      .max(33)
      .nullable()
      .optional()
      .describe(
        "Day of the month to recur on, 1-31; for yearly events set it together with by_month, each with exactly one value",
      ),
    by_year_day: z
      .array(z.number().int().min(-1).max(365))
      .max(367)
      .nullable()
      .optional()
      .describe(
        "Not settable through the API at present, omit it; use by_month with by_month_day for yearly events",
      ),
    count: z
      .number()
      .int()
      .min(1)
      .nullable()
      .optional()
      .describe(
        "Not settable through the API at present; Discord rejects or ignores it, so omit it",
      ),
  })
  .describe(
    "Recurrence rule. Discord supports only simple rules: daily with a fixed weekday set, weekly on one weekday (interval 1 or 2), monthly on one by_n_weekday, or yearly with one by_month and one by_month_day. by_weekday, by_n_weekday and by_month with by_month_day cannot be mixed",
  );

// Strict input entity metadata schema
export const entityMetadataInput = z
  .strictObject({
    location: z
      .string()
      .min(1)
      .max(100)
      .optional()
      .describe(
        "Location description for external events (1-100 characters, required when entity_type is 3=External)",
      ),
  })
  .describe("Additional entity metadata (physical or virtual location for external events)");

// Shared exception input override fields
export const exceptionOverrideInput = {
  scheduled_start_time: z.iso
    .datetime({ offset: true })
    .nullable()
    .optional()
    .describe("Overridden start time for this recurrence occurrence (ISO 8601)"),
  scheduled_end_time: z.iso
    .datetime({ offset: true })
    .nullable()
    .optional()
    .describe("Overridden end time for this recurrence occurrence (ISO 8601)"),
  is_canceled: z
    .boolean()
    .nullable()
    .optional()
    .describe("Whether this specific occurrence in the series is canceled"),
};

// Lenient output schemas
export const entityMetadataOutput = resource(
  z.looseObject({
    location: z.string().nullish(),
  }),
);

export const recurrenceRuleOutput = z.looseObject({
  start: z.string().optional(),
  end: z.string().nullish(),
  frequency: z.number().optional(),
  interval: z.number().nullish(),
  by_weekday: z.array(z.number()).nullish(),
  by_n_weekday: z
    .array(
      z.looseObject({
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

export const guildScheduledEventException = z.looseObject({
  event_id: snowflake,
  event_exception_id: snowflake,
  scheduled_start_time: z.string().nullish(),
  scheduled_end_time: z.string().nullish(),
  is_canceled: z.boolean().optional(),
});

export const guildScheduledEventUser = z.looseObject({
  guild_scheduled_event_id: snowflake.optional(),
  user_id: snowflake.optional(),
  guild_scheduled_event_exception_id: snowflake.nullish(),
  response: z.number().optional(),
  user: user.optional(),
  member: member.optional(),
});

export const guildScheduledEvent = resource(
  z.looseObject({
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
  }),
);

// Shared user list query parameters
export const userListQuery = {
  limit: z
    .number()
    .int()
    .min(1)
    .max(100)
    .optional()
    .describe("Max number of users to return (1-100, default 100)"),
  with_member: z
    .boolean()
    .optional()
    .describe("Whether to include guild member data for each user"),
  before: snowflake
    .optional()
    .describe(
      "Return only users with IDs lower than this one; if after is also set Discord ignores it",
    ),
  after: snowflake
    .optional()
    .describe(
      "User ID cursor to return users after; use next_after from previous page for ascending pagination",
    ),
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
