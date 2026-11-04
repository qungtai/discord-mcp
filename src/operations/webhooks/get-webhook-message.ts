import { type RESTGetAPIWebhookWithTokenMessageResult, Routes } from "discord-api-types/v10";
import { z } from "zod/v4";
import { defineTool } from "../../core/tool-registry.js";
import { messageResult } from "../messages/schemas.js";
import { snowflake } from "../schemas.js";
import { resolveWebhookToken } from "./schemas.js";

export const getWebhookMessage = defineTool({
  name: "discord_get_webhook_message",
  description:
    "Fetch a message previously posted by a webhook. Webhook tools take webhook_id and never a token or webhook URL, resolving the token automatically. Use discord_edit_webhook_message to update the message or discord_delete_webhook_message to remove it. Returns the message object.",
  operationIds: ["get_webhook_message"],
  toolset: "webhooks",
  scope: { webhook: "webhook_id", channel: "thread_id" },
  permissions: ["ManageWebhooks"],
  effect: "read",
  idempotent: true,
  input: z.object({
    webhook_id: snowflake.describe("Snowflake ID of the webhook that sent the message"),
    message_id: snowflake.describe("Snowflake ID of the message sent by the webhook to fetch"),
    thread_id: snowflake
      .optional()
      .describe("Snowflake ID of the thread if the message was posted in a thread"),
  }),
  output: messageResult,
  execute: async ({ webhook_id, message_id, thread_id }, { discord }) => {
    const token = await resolveWebhookToken(webhook_id, discord);
    return {
      message: await discord<RESTGetAPIWebhookWithTokenMessageResult>({
        method: "GET",
        route: Routes.webhookMessage(webhook_id, token, message_id),
        auth: false,
        query: {
          thread_id,
        },
      }),
    };
  },
});
