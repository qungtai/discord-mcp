import { type RESTGetAPIWebhookWithTokenMessageResult, Routes } from "discord-api-types/v10";
import { z } from "zod/v4";
import { defineTool } from "../../core/tool-registry.js";
import { messageResult } from "../messages/schemas.js";
import { snowflake } from "../schemas.js";
import { resolveWebhookToken } from "./schemas.js";

export const getWebhookMessage = defineTool({
  name: "discord_get_webhook_message",
  description: "Get a message previously sent by a webhook",
  operationIds: ["get_webhook_message"],
  toolset: "webhooks",
  scope: { webhook: "webhook_id", channel: "thread_id" },
  permissions: ["ManageWebhooks"],
  effect: "read",
  idempotent: true,
  input: z.object({
    webhook_id: snowflake,
    message_id: snowflake,
    thread_id: snowflake.optional().describe("Thread ID if the message was sent in a thread"),
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
