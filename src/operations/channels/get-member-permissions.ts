import { z } from "zod/v4";
import { defineTool } from "../../core/tool-registry.js";
import { snowflake } from "../schemas.js";
import {
  createPermissionLookupShape,
  exactlyOneScope,
  implicitNeedsChannel,
  permissionLookupRequest,
} from "./schemas.js";

export const getMemberPermissions = defineTool({
  name: "discord_get_member_permissions",
  description:
    "Compute permissions for a guild member either across the guild or within a specific channel. Provide exactly one of guild_id (permissions from roles only) or channel_id (permissions after overwrites). Use discord_get_role_permissions to evaluate role permissions instead. Returns the computed permissions as a decimal bitfield string.",
  operationIds: ["get_channel_member_permissions", "get_guild_member_permissions"],
  toolset: "channels",
  scope: { guild: "guild_id", channel: "channel_id" },
  // ViewChannel is required only for channel-scoped permissions lookup with channel_id.
  permissions: ["ViewChannel"],
  effect: "read",
  idempotent: true,
  input: z
    .object({
      ...createPermissionLookupShape("member"),
      user_id: snowflake.describe("Snowflake ID of the user member whose permissions to evaluate"),
    })
    .refine(exactlyOneScope, { message: "Provide exactly one of guild_id or channel_id" })
    .refine(implicitNeedsChannel, { message: "implicit is only supported with channel_id" }),
  output: z.object({ permissions: z.string() }),
  execute: async ({ user_id, ...lookup }, { discord }) =>
    discord<{ permissions: string }>(permissionLookupRequest("member", user_id, lookup)),
});
