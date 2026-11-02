import { z } from "zod/v4";
import { messageIds } from "../messages/schemas.js";

export const emoji = z
  .string()
  .min(1)
  .describe("URL-encoded emoji (e.g. '👍' or 'name:123456789')");

export const reactionIds = {
  ...messageIds,
  emoji,
};
