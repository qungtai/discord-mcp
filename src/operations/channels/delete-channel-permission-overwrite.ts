import { Routes } from "discord-api-types/v10";
import { z } from "zod/v4";
import { defineTool } from "../../core/tool-registry.js";
import { reason, snowflake } from "../schemas.js";

export const deleteChannelPermissionOverwrite = defineTool({
  name: "discord_delete_channel_permission_overwrite",
  description: "Delete a permission overwrite for a channel",
  operationIds: ["delete_channel_permission_overwrite"],
  toolset: "channels",
  scope: { channel: "channel_id" },
  permissions: ["ManageRoles"],
  effect: "destructive",
  idempotent: true,
  input: z.object({
    channel_id: snowflake,
    overwrite_id: snowflake,
    reason,
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
