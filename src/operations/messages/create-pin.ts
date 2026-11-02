import { Routes } from "discord-api-types/v10";
import { z } from "zod/v4";
import { defineTool } from "../../core/tool-registry.js";
import { reason, snowflake } from "../schemas.js";
import { messageIds } from "./schemas.js";

export const createPin = defineTool({
  name: "discord_create_pin",
  description: "Pin a message in a channel",
  operationIds: ["create_pin", "deprecated_create_pin"],
  toolset: "messages",
  scope: { channel: "channel_id", message: "message_id" },
  permissions: ["ViewChannel", "PinMessages"],
  effect: "write",
  idempotent: true,
  output: z.object({
    pinned: z.literal(true),
    channel_id: snowflake,
    message_id: snowflake,
  }),
  input: z.object({
    ...messageIds,
    reason,
  }),
  execute: async ({ channel_id, message_id, reason }, { discord }) => {
    await discord<void>({
      method: "PUT",
      route: Routes.channelMessagesPin(channel_id, message_id),
      reason,
    });
    return {
      pinned: true as const,
      channel_id,
      message_id,
    };
  },
});
