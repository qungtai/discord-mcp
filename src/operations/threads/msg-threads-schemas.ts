import { z } from "zod/v4";
import {
  allowedMentions,
  channelObject,
  member,
  message,
  resource,
  snowflake,
} from "../schemas.js";

export const autoArchiveDuration = z.union([
  z.literal(60),
  z.literal(1440),
  z.literal(4320),
  z.literal(10080),
]);

export const rateLimitPerUser = z.number().int().min(0).max(21600);

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
  content: z.string().max(4000).optional(),
  embeds: z.array(z.record(z.string(), z.unknown())).max(10).optional(),
  allowed_mentions: allowedMentions,
  sticker_ids: z.array(snowflake).max(3).optional(),
  components: z.array(z.unknown()).max(40).optional(),
  flags: z.number().optional(),
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
