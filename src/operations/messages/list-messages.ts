import { type RESTGetAPIChannelMessagesResult, Routes } from "discord-api-types/v10";
import { z } from "zod/v4";
import { defineTool } from "../../core/tool-registry.js";
import { message, snowflake } from "../schemas.js";

export const listMessages = defineTool({
  name: "discord_list_messages",
  description: "List messages, newest first. Page with before=next_before",
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
    channel_id: snowflake,
    limit: z.number().int().min(1).max(100).optional(),
    before: snowflake.optional(),
    after: snowflake.optional(),
    around: snowflake.optional(),
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
