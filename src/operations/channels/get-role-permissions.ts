import { z } from "zod/v4";
import { defineTool } from "../../core/tool-registry.js";
import { snowflake } from "../schemas.js";
import {
  exactlyOneScope,
  implicitNeedsChannel,
  permissionLookupRequest,
  permissionLookupShape,
} from "./schemas.js";

export const getRolePermissions = defineTool({
  name: "discord_get_role_permissions",
  description: "Get computed guild or channel role permissions",
  operationIds: ["get_channel_role_permissions", "get_guild_role_permissions"],
  toolset: "channels",
  scope: { guild: "guild_id", channel: "channel_id" },
  // ViewChannel is required only for channel-scoped permissions lookup with channel_id.
  permissions: ["ViewChannel"],
  effect: "read",
  idempotent: true,
  input: z
    .object({ ...permissionLookupShape, role_id: snowflake })
    .refine(exactlyOneScope, { message: "Provide exactly one of guild_id or channel_id" })
    .refine(implicitNeedsChannel, { message: "implicit is only supported with channel_id" }),
  output: z.object({ permissions: z.string() }),
  execute: async ({ role_id, ...lookup }, { discord }) =>
    discord<{ permissions: string }>(permissionLookupRequest("role", role_id, lookup)),
});
