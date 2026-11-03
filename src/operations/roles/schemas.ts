import { z } from "zod/v4";
import { role as sharedRole, snowflake } from "../schemas.js";

export const roleColors = z.strictObject({
  primary_color: z.number().int().min(0).max(16777215),
  secondary_color: z.number().int().min(0).max(16777215).nullish(),
  tertiary_color: z.number().int().min(0).max(16777215).nullish(),
});

export const role = sharedRole.extend({
  hoist: z.boolean().optional(),
  mentionable: z.boolean().optional(),
  icon: z.string().nullish(),
  unicode_emoji: z.string().nullish(),
  flags: z.number().optional(),
  colors: z.unknown().optional(),
  tags: z.unknown().optional(),
});

export const roleResult = z.object({ role });
export const rolesResult = z.object({ roles: z.array(role) });
export const roleMemberCountsResult = z.object({
  counts: z.record(snowflake, z.number()),
});
