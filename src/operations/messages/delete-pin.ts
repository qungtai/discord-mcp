import { Routes } from "discord-api-types/v10";
import { z } from "zod/v4";
import { defineTool } from "../../core/tool-registry.js";
import { reason, snowflake } from "../schemas.js";
import { messageIds } from "./schemas.js";

export const deletePin = defineTool({
  name: "discord_delete_pin",
  description:
    "Unpin a pinned message from a channel or thread. To add a pin use discord_create_pin, and to list all current pinned messages use discord_list_pins. Returns a confirmation object with the unpinned message and channel IDs.",
  operationIds: ["delete_pin", "deprecated_delete_pin"],
  toolset: "messages",
  scope: { channel: "channel_id", message: "message_id" },
  permissions: ["ViewChannel", "PinMessages"],
  effect: "destructive",
  // Unpinning is reversible and removes no content, so it is safe without approval.
  approval: false,
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
      route: Routes.channelMessagesPin(channel_id, message_id),
      reason,
    });
    return {
      unpinned: true as const,
      channel_id,
      message_id,
    };
  },
});
