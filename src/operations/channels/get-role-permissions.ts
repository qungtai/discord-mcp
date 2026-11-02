import { z } from "zod/v4";
import { PToolError } from "../../core/tool-error.js";
import { defineTool } from "../../core/tool-registry.js";
import { snowflake } from "../schemas.js";

export const getRolePermissions = defineTool({
  name: "discord_get_role_permissions",
  description: "Get computed guild or channel role permissions",
  operationIds: ["get_channel_role_permissions", "get_guild_role_permissions"],
  toolset: "channels",
  scope: { guild: "guild_id", channel: "channel_id" },
  permissions: ["ViewChannel"],
  effect: "read",
  idempotent: true,
  input: z.object({
    guild_id: snowflake.optional(),
    channel_id: snowflake.optional(),
    role_id: snowflake,
    implicit: z.boolean().optional(),
  }),
  output: z.object({
    permissions: z.string(),
  }),
  execute: async ({ guild_id, channel_id, role_id, implicit }, { discord }) => {
    if ((guild_id && channel_id) || (!guild_id && !channel_id)) {
      throw new PToolError("Must provide exactly one of guild_id or channel_id", {
        category: "validation",
        retryable: false,
        remediation: "pass exactly one of guild_id, channel_id",
      });
    }
    if (guild_id && implicit !== undefined) {
      throw new PToolError("implicit is only supported for channel role permissions", {
        category: "validation",
        retryable: false,
        remediation: "Remove implicit when querying guild role permissions",
      });
    }
    const route = channel_id
      ? (`/channels/${channel_id}/permissions/role/${role_id}` as const)
      : (`/guilds/${guild_id}/permissions/role/${role_id}` as const);
    return discord<{ permissions: string }>({
      method: "GET",
      route,
      query: implicit !== undefined ? { implicit } : undefined,
    });
  },
});
