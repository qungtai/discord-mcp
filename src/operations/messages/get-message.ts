import { type RESTGetAPIChannelMessageResult, Routes } from "discord-api-types/v10";
import { z } from "zod/v4";
import { defineTool } from "../../core/tool-registry.js";
import { messageIds, messageResult } from "./schemas.js";

export const getMessage = defineTool({
  name: "discord_get_message",
  description:
    "Fetch one message by ID from a channel or thread, with its author, content, attachments, embeds, reactions and poll. Use it when you already have the message ID; to read recent history use discord_list_messages, and to find messages by text use discord_search_guild_messages.",
  operationIds: ["get_message"],
  toolset: "messages",
  scope: { channel: "channel_id", message: "message_id" },
  permissions: ["ViewChannel", "ReadMessageHistory"],
  effect: "read",
  idempotent: true,
  output: messageResult,
  input: z.object(messageIds),
  execute: async (p, { discord }) => ({
    message: await discord<RESTGetAPIChannelMessageResult>({
      method: "GET",
      route: Routes.channelMessage(p.channel_id, p.message_id),
    }),
  }),
});
