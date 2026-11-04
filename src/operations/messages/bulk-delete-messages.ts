import { Routes } from "discord-api-types/v10";
import { z } from "zod/v4";
import { defineTool } from "../../core/tool-registry.js";
import { reason, snowflake } from "../schemas.js";

export const bulkDeleteMessages = defineTool({
  name: "discord_bulk_delete_messages",
  description:
    "Delete 2 to 100 messages from a guild channel in one request. The whole request fails if any message is older than 14 days or any message ID is duplicated. To delete a single message instead use discord_delete_message.",
  operationIds: ["bulk_delete_messages"],
  toolset: "messages",
  scope: { channel: "channel_id", message: "message_ids" },
  permissions: ["ViewChannel", "ManageMessages"],
  effect: "destructive",
  idempotent: false,
  output: z.object({
    deleted: z.literal(true),
    channel_id: snowflake,
    message_ids: z.array(snowflake),
  }),
  input: z.object({
    channel_id: snowflake.describe("ID of the channel containing the messages to delete"),
    message_ids: z
      .array(snowflake.describe("Message snowflake ID to delete"))
      .min(2, "Bulk delete requires at least 2 messages")
      .max(100, "Bulk delete cannot exceed 100 messages")
      .refine((ids) => new Set(ids).size === ids.length, "Message IDs must be unique")
      .describe("Array of 2 to 100 unique message IDs younger than 14 days to delete"),
    reason,
  }),
  execute: async ({ channel_id, message_ids, reason }, { discord }) => {
    await discord<void>({
      method: "POST",
      route: Routes.channelBulkDelete(channel_id),
      body: { messages: message_ids },
      reason,
    });
    return {
      deleted: true as const,
      channel_id,
      message_ids,
    };
  },
});
