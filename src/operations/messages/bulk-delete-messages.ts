import { Routes } from "discord-api-types/v10";
import { z } from "zod/v4";
import { defineTool } from "../../core/tool-registry.js";
import { reason, snowflake } from "../schemas.js";
import { messageIdList } from "./msg-pins-schemas.js";

export const bulkDeleteMessages = defineTool({
  name: "discord_bulk_delete_messages",
  description: "Delete multiple messages (2-100) at once from a channel",
  operationIds: ["bulk_delete_messages"],
  toolset: "messages",
  scope: { channel: "channel_id" },
  permissions: ["ViewChannel", "ManageMessages"],
  effect: "destructive",
  idempotent: false,
  output: z.object({
    deleted: z.literal(true),
    channel_id: snowflake,
    count: z.number(),
  }),
  input: z.object({
    channel_id: snowflake,
    messages: messageIdList,
    reason,
  }),
  execute: async ({ channel_id, messages, reason }, { discord }) => {
    await discord<void>({
      method: "POST",
      route: Routes.channelBulkDelete(channel_id),
      body: { messages },
      reason,
    });
    return {
      deleted: true as const,
      channel_id,
      count: messages.length,
    };
  },
});
