import { z } from "zod/v4";
import { channel, snowflake } from "../schemas.js";

export const channelResult = z.object({ channel });

export const channelTypeEnum = z.union([
  z.literal(0),
  z.literal(2),
  z.literal(4),
  z.literal(5),
  z.literal(13),
  z.literal(14),
  z.literal(15),
]);

export const videoQualityModeEnum = z.union([z.literal(1), z.literal(2)]);

export const threadAutoArchiveDurationEnum = z.union([
  z.literal(60),
  z.literal(1440),
  z.literal(4320),
  z.literal(10080),
]);

export const threadSortOrderEnum = z.union([z.literal(0), z.literal(1)]);

export const forumLayoutEnum = z.union([z.literal(0), z.literal(1), z.literal(2)]);

export const threadSearchTagSettingEnum = z.union([
  z.literal("match_all"),
  z.literal("match_some"),
]);

export const permissionOverwrite = z.strictObject({
  id: snowflake,
  type: z.union([z.literal(0), z.literal(1)]).nullish(),
  allow: z.union([z.string(), z.number()]).nullish(),
  deny: z.union([z.string(), z.number()]).nullish(),
});

export const defaultReactionEmoji = z.strictObject({
  emoji_id: snowflake.nullish(),
  emoji_name: z.string().max(100).nullish(),
});

export const forumTag = z.strictObject({
  id: snowflake.optional(),
  name: z.string().min(0).max(50),
  moderated: z.boolean().nullish(),
  emoji_id: snowflake.nullish(),
  emoji_name: z.string().max(100).nullish(),
});
