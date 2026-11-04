import { z } from "zod/v4";
import { snowflake } from "../schemas.js";

export const emoji = z
  .string()
  .min(1)
  .describe(
    "URL-encoded emoji string, either a Unicode emoji (e.g. '👍' or '%F0%9F%91%8D') or a custom emoji in the format 'name:id' (e.g. 'party_blob:123456789012345678')",
  );

export const reactionIds = {
  channel_id: snowflake.describe("ID of the channel or thread holding the message"),
  message_id: snowflake.describe("ID of the message to target"),
  emoji,
};
