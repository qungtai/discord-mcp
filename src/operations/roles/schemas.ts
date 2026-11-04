import { z } from "zod/v4";
import { resource, roleObject, snowflake } from "../schemas.js";

export const roleColors = z.strictObject({
  primary_color: z
    .number()
    .int()
    .min(0)
    .max(16777215)
    .describe("Primary RGB color as an integer between 0 and 16777215 (e.g. 0xFF0000 for red)"),
  secondary_color: z
    .number()
    .int()
    .min(0)
    .max(16777215)
    .nullish()
    .describe("Secondary RGB color integer for gradient role styling, or null"),
  tertiary_color: z
    .number()
    .int()
    .min(0)
    .max(16777215)
    .nullish()
    .describe("Tertiary RGB color integer for gradient role styling, or null"),
});

export const role = resource(
  roleObject.extend({
    hoist: z.boolean().optional(),
    mentionable: z.boolean().optional(),
    icon: z.string().nullish(),
    unicode_emoji: z.string().nullish(),
    flags: z.number().optional(),
    colors: z.unknown().optional(),
    tags: z.unknown().optional(),
  }),
);

export const roleResult = z.object({ role });
export const rolesResult = z.object({ roles: z.array(role) });
export const roleMemberCountsResult = z.object({
  counts: z.record(snowflake, z.number()),
});
