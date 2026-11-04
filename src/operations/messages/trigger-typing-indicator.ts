import { Routes } from "discord-api-types/v10";
import { z } from "zod/v4";
import { defineTool } from "../../core/tool-registry.js";
import { snowflake } from "../schemas.js";

export const triggerTypingIndicator = defineTool({
  name: "discord_trigger_typing_indicator",
  description:
    "Show the typing indicator in a channel or thread for 10 seconds, for a bot that needs a few seconds to prepare an answer. Discord advises most bots not to use it. To post the reply use discord_send_message.",
  operationIds: ["trigger_typing_indicator"],
  toolset: "messages",
  scope: { channel: "channel_id" },
  // SendMessagesInThreads is required when triggering typing in a thread channel.
  permissions: ["ViewChannel", "SendMessages", "SendMessagesInThreads"],
  effect: "write",
  idempotent: false,
  output: z.object({
    triggered: z.literal(true),
    channel_id: snowflake,
  }),
  input: z.object({
    channel_id: snowflake.describe("ID of the channel or thread to display typing indicator in"),
  }),
  execute: async ({ channel_id }, { discord }) => {
    await discord<void>({
      method: "POST",
      route: Routes.channelTyping(channel_id),
    });
    return {
      triggered: true as const,
      channel_id,
    };
  },
});
