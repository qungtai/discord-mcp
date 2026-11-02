import { z } from "zod/v4";
import { message, snowflake } from "../schemas.js";

export const pinnedMessage = z.object({
  pinned_at: z.string(),
  message,
});

export const pinnedMessages = z.object({
  items: z.array(pinnedMessage),
  has_more: z.boolean(),
});

export const messageIdList = z
  .array(snowflake)
  .min(2, "Bulk delete requires at least 2 messages")
  .max(100, "Bulk delete cannot exceed 100 messages");
