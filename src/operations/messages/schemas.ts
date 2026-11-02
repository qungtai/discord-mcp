import { z } from "zod/v4";
import { allowedMentions, message, snowflake } from "../schemas.js";

export const messageIds = { channel_id: snowflake, message_id: snowflake };
export const messageBody = {
  content: z.string().optional(),
  embeds: z.array(z.record(z.string(), z.unknown())).optional(),
  allowed_mentions: allowedMentions,
};
export const messageResult = z.object({ message });
