import { Routes } from "discord-api-types/v10";
import { z } from "zod/v4";
import { defineTool } from "../../core/tool-registry.js";
import { snowflake } from "../schemas.js";
import { resolveWebhookToken } from "./schemas.js";

export const deleteWebhookMessage = defineTool({
  name: "discord_delete_webhook_message",
  description: "Delete a message previously sent by a webhook",
  operationIds: ["delete_webhook_message"],
  toolset: "webhooks",
  scope: { webhook: "webhook_id", channel: "thread_id" },
  permissions: ["ManageWebhooks"],
  effect: "destructive",
  idempotent: true,
  input: z.object({
    webhook_id: snowflake,
    message_id: snowflake,
    thread_id: snowflake.optional().describe("Thread ID if the message was sent in a thread"),
  }),
  output: z.object({
    deleted: z.literal(true),
    webhook_id: snowflake,
    message_id: snowflake,
  }),
  execute: async ({ webhook_id, message_id, thread_id }, { discord }) => {
    const token = await resolveWebhookToken(webhook_id, discord);
    await discord<void>({
      method: "DELETE",
      route: Routes.webhookMessage(webhook_id, token, message_id),
      auth: false,
      query: {
        thread_id,
      },
    });
    return {
      deleted: true as const,
      webhook_id,
      message_id,
    };
  },
});
