import { z } from "zod/v4";
import {
  allowedMentions,
  channelObject,
  member,
  message,
  resource,
  snowflake,
} from "../schemas.js";

export const threadMetadata = z
  .looseObject({
    archived: z.boolean().optional(),
    archive_timestamp: z.string().nullish(),
    auto_archive_duration: z.number().optional(),
    locked: z.boolean().optional(),
    create_timestamp: z.string().nullish(),
    invitable: z.boolean().optional(),
  })
  .partial();

export const thread = resource(
  channelObject.extend({
    owner_id: snowflake.optional(),
    thread_metadata: threadMetadata.optional(),
    message_count: z.number().optional(),
    member_count: z.number().optional(),
    total_message_sent: z.number().optional(),
    applied_tags: z.array(snowflake).optional(),
  }),
);

export const threadMember = resource(
  z.looseObject({
    id: snowflake.optional(),
    user_id: snowflake.optional(),
    join_timestamp: z.string().optional(),
    flags: z.number().optional(),
    member: member.optional(),
  }),
);

export const forumInitialMessage = z.strictObject({
  content: z
    .string()
    .max(4000)
    .optional()
    .describe("Text content of the first post or message (up to 4000 characters)"),
  embeds: z
    .array(z.record(z.string(), z.unknown()))
    .max(10)
    .optional()
    .describe("Up to 10 rich embed objects to include in the starter post"),
  allowed_mentions: allowedMentions.describe(
    "Allowed mentions specification controlling who receives mention notifications",
  ),
  sticker_ids: z
    .array(snowflake)
    .max(3)
    .optional()
    .describe("IDs of up to 3 stickers to attach to the starter post"),
  components: z
    .array(z.unknown())
    .max(40)
    .optional()
    .describe("Interactive message components such as buttons or select menus (up to 40)"),
  flags: z
    .number()
    .optional()
    .describe(
      "Message flags integer bitfield, such as SUPPRESS_EMBEDS (4) or SUPPRESS_NOTIFICATIONS (4096)",
    ),
});

export const threadList = z.object({
  threads: z.array(thread),
  members: z.array(threadMember),
  has_more: z.boolean().optional(),
  total_results: z.number().optional(),
  first_messages: z.array(message).optional(),
  next_before: z.string().nullable().optional(),
  next_after: z.string().nullable().optional(),
  next_offset: z.number().nullable().optional(),
});
