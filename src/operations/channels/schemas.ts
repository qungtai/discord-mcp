import { Routes } from "discord-api-types/v10";
import { z } from "zod/v4";
import type { DiscordRequestInit } from "../../core/ports.js";
import { channel, permissionBits, snowflake } from "../schemas.js";

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

export const threadSortOrderEnum = z.union([z.literal(0), z.literal(1)]);

export const forumLayoutEnum = z.union([z.literal(0), z.literal(1), z.literal(2)]);

export const permissionOverwrite = z.strictObject({
  id: snowflake,
  type: z.union([z.literal(0), z.literal(1)]).nullish(),
  allow: permissionBits.nullish(),
  deny: permissionBits.nullish(),
});

// Both permission lookups take exactly one of guild_id or channel_id, and implicit only with a channel.
export const permissionLookupShape = {
  guild_id: snowflake.optional(),
  channel_id: snowflake.optional(),
  implicit: z.boolean().optional().describe("Include implicit @everyone permissions"),
};
export const exactlyOneScope = (input: { guild_id?: string; channel_id?: string }) =>
  (input.guild_id === undefined) !== (input.channel_id === undefined);
export const implicitNeedsChannel = (input: { channel_id?: string; implicit?: boolean }) =>
  input.implicit === undefined || input.channel_id !== undefined;
export function permissionLookupRequest(
  target: "member" | "role",
  id: string,
  lookup: { guild_id?: string; channel_id?: string; implicit?: boolean },
): DiscordRequestInit {
  const query = lookup.implicit === undefined ? undefined : { implicit: lookup.implicit };
  if (lookup.channel_id)
    return {
      method: "GET",
      route: `${Routes.channel(lookup.channel_id)}/permissions/${target}/${id}`,
      query,
    };
  // The input schema requires guild_id when channel_id is absent.
  if (!lookup.guild_id) throw new Error("guild_id or channel_id is required");
  return {
    method: "GET",
    route: `${Routes.guild(lookup.guild_id)}/permissions/${target}/${id}`,
    query,
  };
}

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
