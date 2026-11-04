import { type RESTGetAPIChannelMessagesResult, Routes } from "discord-api-types/v10";
import { z } from "zod/v4";
import { defineTool } from "../../core/tool-registry.js";
import { message, snowflake } from "../schemas.js";

export const listMessages = defineTool({
  name: "discord_list_messages",
  description:
    "List messages from a channel or thread, newest first. Provide before, after, or around snowflake IDs to paginate or center the search window. To fetch a specific message by ID use discord_get_message, and to search messages by text or author across an entire server use discord_search_guild_messages. Page older messages with before=next_before.",
  operationIds: ["list_messages"],
  toolset: "messages",
  scope: { channel: "channel_id" },
  permissions: ["ViewChannel", "ReadMessageHistory"],
  effect: "read",
  idempotent: true,
  output: z.object({
    messages: z.array(message),
    next_before: snowflake.nullable(),
    next_after: snowflake.nullable(),
  }),
  input: z.object({
    channel_id: snowflake.describe("ID of the channel or thread to list messages from"),
    limit: z
      .number()
      .int()
      .min(1)
      .max(100)
      .optional()
      .describe("Max number of messages to return (1-100; default is 50)"),
    before: snowflake
      .optional()
      .describe(
        "Get messages posted before this message snowflake ID (use next_before to page backward in time)",
      ),
    after: snowflake
      .optional()
      .describe(
        "Get messages posted after this message snowflake ID (use next_after to page forward in time)",
      ),
    around: snowflake
      .optional()
      .describe(
        "Get messages centered around this message snowflake ID (cannot be combined with before or after)",
      ),
  }),
  execute: async ({ channel_id, ...query }, { discord }) => {
    const messages = await discord<RESTGetAPIChannelMessagesResult>({
      method: "GET",
      route: Routes.channelMessages(channel_id),
      query,
    });
    return {
      messages,
      next_before: messages.at(-1)?.id ?? null,
      next_after: messages[0]?.id ?? null,
    };
  },
});
