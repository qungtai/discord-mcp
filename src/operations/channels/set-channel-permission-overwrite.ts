import { Routes } from "discord-api-types/v10";
import { z } from "zod/v4";
import { defineTool } from "../../core/tool-registry.js";
import { permissionBits, reason, snowflake } from "../schemas.js";

export const setChannelPermissionOverwrite = defineTool({
  name: "discord_set_channel_permission_overwrite",
  description:
    "Set or edit a permission overwrite for a role or member in a channel. Overwrites combine allow and deny bitfields, with member overwrites taking precedence over role overwrites. Use discord_delete_channel_permission_overwrite to remove an overwrite completely. Returns the updated status with channel and overwrite IDs.",
  operationIds: ["set_channel_permission_overwrite"],
  toolset: "channels",
  scope: { channel: "channel_id" },
  permissions: ["ManageRoles"],
  effect: "destructive",
  idempotent: true,
  input: z.object({
    channel_id: snowflake.describe("Snowflake ID of the channel where the overwrite applies"),
    overwrite_id: snowflake.describe(
      "Snowflake ID of the role or member to apply the overwrite to",
    ),
    type: z
      .literal([0, 1])
      .describe("Target entity type of the overwrite: 0 for role, 1 for member"),
    allow: permissionBits
      .optional()
      .describe(
        "Decimal permission bitfield string representing permissions explicitly allowed (defaults to 0)",
      ),
    deny: permissionBits
      .optional()
      .describe(
        "Decimal permission bitfield string representing permissions explicitly denied (defaults to 0)",
      ),
    reason: reason.describe("Reason for setting the permission overwrite in the guild audit log"),
  }),
  output: z.object({
    channel_id: snowflake,
    overwrite_id: snowflake,
    updated: z.literal(true),
  }),
  execute: async ({ channel_id, overwrite_id, reason, ...body }, { discord }) => {
    await discord({
      method: "PUT",
      route: Routes.channelPermission(channel_id, overwrite_id),
      body,
      reason,
    });
    return { channel_id, overwrite_id, updated: true as const };
  },
});
