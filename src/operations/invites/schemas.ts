import { z } from "zod/v4";
import { channel, codeParam, resource, snowflake, user } from "../schemas.js";

export const inviteCode = codeParam("invite").describe(
  "Unique invite code string identifying the invite (alphanumeric with dashes, no URL or path)",
);

export const targetUserIds = z
  .array(snowflake)
  .min(1)
  .max(1000)
  .describe("Array of 1 to 1000 user snowflake IDs to target with this invite");

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
