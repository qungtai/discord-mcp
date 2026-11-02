import { z } from "zod/v4";
import { channel, member, message, snowflake } from "../schemas.js";

export const threadMember = z.object({
  id: snowflake.optional(),
  user_id: snowflake.optional(),
  join_timestamp: z.string().optional(),
  flags: z.number().optional(),
  member: member.optional(),
});

export const threadList = z.object({
  threads: z.array(channel),
  members: z.array(threadMember),
  has_more: z.boolean().optional(),
  total_results: z.number().optional(),
  first_messages: z.array(message).optional(),
});
