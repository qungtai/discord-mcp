import { Routes } from "discord-api-types/v10";
import { z } from "zod/v4";
import { defineTool } from "../../core/tool-registry.js";
import { reason, snowflake } from "../schemas.js";
import { messageIds } from "./schemas.js";

export const deleteMessage = defineTool({
  name: "discord_delete_message",
  description:
    "Permanently delete a single message from a channel or thread. To delete between 2 and 100 recent messages at once use discord_bulk_delete_messages. Returns a confirmation object with the deleted message and channel IDs.",
  operationIds: ["delete_message"],
  toolset: "messages",
  scope: { channel: "channel_id", message: "message_id" },
  permissions: ["ViewChannel", "ManageMessages"],
  effect: "destructive",
  idempotent: true,
  output: z.object({
    deleted: z.literal(true),
    channel_id: snowflake,
    message_id: snowflake,
  }),
  input: z.object({
    ...messageIds,
    reason,
  }),
  execute: async ({ channel_id, message_id, reason }, { discord }) => {
    await discord<void>({
      method: "DELETE",
      route: Routes.channelMessage(channel_id, message_id),
      reason,
    });
    return {
      deleted: true as const,
      channel_id,
      message_id,
    };
  },
});
