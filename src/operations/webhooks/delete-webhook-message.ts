import { Routes } from "discord-api-types/v10";
import { z } from "zod/v4";
import { defineTool } from "../../core/tool-registry.js";
import { snowflake } from "../schemas.js";
import { resolveWebhookToken } from "./schemas.js";

export const deleteWebhookMessage = defineTool({
  name: "discord_delete_webhook_message",
  description:
    "Permanently delete a message previously sent by a webhook. Webhook tools take webhook_id and never a token or webhook URL, resolving the token automatically. Deleting a message cannot be undone. Returns the deleted status along with webhook and message IDs.",
  operationIds: ["delete_webhook_message"],
  toolset: "webhooks",
  scope: { webhook: "webhook_id", channel: "thread_id" },
  permissions: ["ManageWebhooks"],
  effect: "destructive",
  idempotent: true,
  input: z.object({
    webhook_id: snowflake.describe("Snowflake ID of the webhook that sent the message"),
    message_id: snowflake.describe("Snowflake ID of the message to delete"),
    thread_id: snowflake
      .optional()
      .describe("Snowflake ID of the thread if the message was sent in a thread"),
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
