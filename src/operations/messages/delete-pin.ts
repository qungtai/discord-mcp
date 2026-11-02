import { Routes } from "discord-api-types/v10";
import { z } from "zod/v4";
import { defineTool } from "../../core/tool-registry.js";
import { reason, snowflake } from "../schemas.js";
import { messageIds } from "./schemas.js";

export const deletePin = defineTool({
  name: "discord_delete_pin",
  description: "Unpin a message in a channel",
  operationIds: ["delete_pin", "deprecated_delete_pin"],
  toolset: "messages",
  scope: { channel: "channel_id", message: "message_id" },
  permissions: ["ViewChannel", "ManageMessages"],
  effect: "destructive",
  idempotent: true,
  output: z.object({
    unpinned: z.literal(true),
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
      route: Routes.channelPin(channel_id, message_id),
      reason,
    });
    return {
      unpinned: true as const,
      channel_id,
      message_id,
    };
  },
});
