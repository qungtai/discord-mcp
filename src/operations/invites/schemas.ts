import { z } from "zod/v4";
import { channel, snowflake, user } from "../schemas.js";

export const invite = z.object({
  code: z.string(),
  guild_id: snowflake.optional(),
  channel: channel.nullish(),
  inviter: user.optional(),
  target_type: z.number().optional(),
  target_user: user.optional(),
  approximate_presence_count: z.number().nullish(),
  approximate_member_count: z.number().nullish(),
  expires_at: z.string().nullish(),
  uses: z.number().optional(),
  max_uses: z.number().optional(),
  max_age: z.number().optional(),
  temporary: z.boolean().optional(),
  created_at: z.string().optional(),
});
