import { Routes } from "discord-api-types/v10";
import { z } from "zod/v4";
import { defineTool } from "../../core/tool-registry.js";
import { reason, snowflake } from "../schemas.js";

export const deleteChannel = defineTool({
  name: "discord_delete_channel",
  description:
    "Delete a guild channel or thread, or close a direct message (DM) channel. Deleting a guild channel cannot be undone. To archive a thread without deleting it, use discord_update_channel with archived: true. Returns the deleted status and channel ID.",
  operationIds: ["delete_channel"],
  toolset: "channels",
  scope: { channel: "channel_id" },
  permissions: ["ManageChannels", "ManageThreads"],
  effect: "destructive",
  idempotent: true,
  input: z.object({
    channel_id: snowflake.describe("Snowflake ID of the channel, thread or DM to delete or close"),
    reason: reason.describe("Reason for deleting the channel in the guild audit log"),
  }),
  output: z.object({
    deleted: z.literal(true),
    channel_id: snowflake,
  }),
  execute: async ({ channel_id, reason }, { discord }) => {
    await discord({
      method: "DELETE",
      route: Routes.channel(channel_id),
      reason,
    });
    return { deleted: true as const, channel_id };
  },
});
