import { z } from "zod/v4";
import { channel, snowflake } from "../schemas.js";

export const channelResult = z.object({ channel });

export const channelPosition = z.strictObject({
  id: snowflake,
  position: z.number().int().min(0).nullish(),
  parent_id: snowflake.nullish(),
  lock_permissions: z.boolean().nullish(),
});
