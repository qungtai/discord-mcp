import { Routes } from "discord-api-types/v10";
import { z } from "zod/v4";
import { defineTool } from "../../core/tool-registry.js";
import { reason, snowflake } from "../schemas.js";

export const deleteChannelPermissionOverwrite = defineTool({
  name: "discord_delete_channel_permission_overwrite",
  description:
    "Delete a channel permission overwrite for a role or member, restoring default inheritance from the category or server. Use discord_set_channel_permission_overwrite to create or modify an overwrite instead. Returns the deleted status along with channel and overwrite IDs.",
  operationIds: ["delete_channel_permission_overwrite"],
  toolset: "channels",
  scope: { channel: "channel_id" },
  permissions: ["ManageRoles"],
  effect: "destructive",
  idempotent: true,
  input: z.object({
    channel_id: snowflake.describe("Snowflake ID of the channel holding the overwrite"),
    overwrite_id: snowflake.describe("Snowflake ID of the role or member overwrite to delete"),
    reason: reason.describe("Reason for deleting the permission overwrite in the guild audit log"),
  }),
  output: z.object({
    deleted: z.literal(true),
    channel_id: snowflake,
    overwrite_id: snowflake,
  }),
  execute: async ({ channel_id, overwrite_id, reason }, { discord }) => {
    await discord({
      method: "DELETE",
      route: Routes.channelPermission(channel_id, overwrite_id),
      reason,
    });
    return { deleted: true as const, channel_id, overwrite_id };
  },
});
