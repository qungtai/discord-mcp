import { z } from "zod/v4";
import { defineTool } from "../../core/tool-registry.js";
import { snowflake } from "../schemas.js";
import {
  exactlyOneScope,
  implicitNeedsChannel,
  permissionLookupRequest,
  permissionLookupShape,
} from "./ch-channels-schemas.js";

export const getMemberPermissions = defineTool({
  name: "discord_get_member_permissions",
  description: "Get computed guild or channel member permissions",
  operationIds: ["get_channel_member_permissions", "get_guild_member_permissions"],
  toolset: "channels",
  scope: { guild: "guild_id", channel: "channel_id" },
  permissions: ["ViewChannel"],
  effect: "read",
  idempotent: true,
  input: z
    .object({ ...permissionLookupShape, user_id: snowflake })
    .refine(exactlyOneScope, { message: "Provide exactly one of guild_id or channel_id" })
    .refine(implicitNeedsChannel, { message: "implicit is only supported with channel_id" }),
  output: z.object({ permissions: z.string() }),
  execute: async ({ user_id, ...lookup }, { discord }) =>
    discord<{ permissions: string }>(permissionLookupRequest("member", user_id, lookup)),
});
