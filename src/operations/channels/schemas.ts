import { Routes } from "discord-api-types/v10";
import { z } from "zod/v4";
import type { DiscordRequestInit } from "../../core/ports.js";
import { channel, permissionBits, snowflake } from "../schemas.js";

export const channelResult = z.object({ channel });

export const channelTypeEnum = z.union([
  z.literal(0).describe("0: Guild text channel"),
  z.literal(2).describe("2: Guild voice channel"),
  z.literal(4).describe("4: Channel category"),
  z.literal(5).describe("5: Guild announcement channel"),
  z.literal(13).describe("13: Stage voice channel"),
  z.literal(14).describe("14: Directory channel"),
  z.literal(15).describe("15: Forum channel"),
]);

export const videoQualityModeEnum = z.union([
  z.literal(1).describe("1: Auto (system determines quality)"),
  z.literal(2).describe("2: Full (720p at 60fps)"),
]);

export const threadSortOrderEnum = z.union([
  z.literal(0).describe("0: Latest activity"),
  z.literal(1).describe("1: Creation date"),
]);

export const forumLayoutEnum = z.union([
  z.literal(0).describe("0: Not set (uses guild default)"),
  z.literal(1).describe("1: List view"),
  z.literal(2).describe("2: Grid / gallery view"),
]);

export const permissionOverwrite = z.strictObject({
  id: snowflake.describe("ID of the role or member this overwrite applies to"),
  type: z
    .union([z.literal(0), z.literal(1)])
    .nullish()
    .describe("Overwrite target type: 0 for role, 1 for member"),
  allow: permissionBits
    .nullish()
    .describe(
      "Permission bitfield string representing permissions explicitly granted by this overwrite",
    ),
  deny: permissionBits
    .nullish()
    .describe(
      "Permission bitfield string representing permissions explicitly denied by this overwrite",
    ),
});

// Both permission lookups take exactly one of guild_id or channel_id, and implicit only with a channel.
export const createPermissionLookupShape = (targetNoun: "member" | "role") => ({
  guild_id: snowflake
    .optional()
    .describe(
      `Guild ID to compute base guild-level permissions for the ${targetNoun} across the server. Provide exactly one of guild_id or channel_id.`,
    ),
  channel_id: snowflake
    .optional()
    .describe(
      `Channel ID to compute effective permissions for the ${targetNoun} after applying role and member overwrites. Provide exactly one of guild_id or channel_id.`,
    ),
  implicit: z
    .boolean()
    .optional()
    .describe(
      "Whether to apply implicit permission masking: without ViewChannel (or Connect on voice and stage channels) the other permissions are cleared. Discord defaults to true. Only valid with channel_id.",
    ),
});
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
  emoji_id: snowflake
    .nullish()
    .describe("ID of a custom guild emoji to use as default reaction on forum posts"),
  emoji_name: z
    .string()
    .max(100)
    .nullish()
    .describe("Unicode character of the default reaction emoji when using standard emoji"),
});

export const forumTag = z.strictObject({
  id: snowflake
    .optional()
    .describe("ID of an existing tag when updating, or omitted when creating a new tag"),
  name: z.string().min(0).max(50).describe("Name of the tag (0-50 characters)"),
  moderated: z
    .boolean()
    .nullish()
    .describe("Whether only moderators with ManageThreads can apply this tag"),
  emoji_id: snowflake.nullish().describe("ID of a custom guild emoji associated with this tag"),
  emoji_name: z
    .string()
    .max(100)
    .nullish()
    .describe("Unicode character of the standard emoji associated with this tag"),
});
