import { z } from "zod/v4";
import { message } from "../schemas.js";

export const pinnedMessage = z.object({
  pinned_at: z.string(),
  message,
});
