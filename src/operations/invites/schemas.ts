import { z } from "zod/v4";
import { channel, resource, snowflake, user } from "../schemas.js";

export const inviteCode = z
  .string()
  .min(1)
  .regex(/^[\w-]+$/, "Expected an invite code without path segments");

export const invite = resource(
  z.looseObject({
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
  }),
);

export const targetUsersJobStatus = resource(
  z.looseObject({
    status: z.number().int(),
    total_users: z.number().int(),
    processed_users: z.number().int(),
    created_at: z.string().nullish(),
    completed_at: z.string().nullish(),
    error_message: z.string().nullish(),
  }),
);
