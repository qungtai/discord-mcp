import { z } from "zod/v4";
import { message, resource } from "../schemas.js";

export const pinnedMessage = resource(
  z.looseObject({
    pinned_at: z.string(),
    message,
  }),
);
