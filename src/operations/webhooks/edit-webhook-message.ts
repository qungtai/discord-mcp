import {
  type RESTGetAPIWebhookWithTokenMessageResult,
  type RESTPatchAPIWebhookWithTokenMessageResult,
  Routes,
} from "discord-api-types/v10";
import { z } from "zod/v4";
import { defineTool } from "../../core/tool-registry.js";
import { messageResult } from "../messages/schemas.js";
import { snowflake } from "../schemas.js";
import {
  resolveWebhookToken,
  webhookAllowedMentions,
  webhookAttachmentUpdate,
  webhookFileUpload,
} from "./schemas.js";

export const editWebhookMessage = defineTool({
  name: "discord_edit_webhook_message",
  description:
    "Edit a message previously sent by a webhook, modifying content, embeds, attachments, or allowed mentions. Webhook tools take webhook_id and never a token or webhook URL, resolving the token automatically. Use discord_get_webhook_message to read the current message. Returns the updated message object.",
  operationIds: ["get_webhook_message", "update_webhook_message"],
  toolset: "webhooks",
  scope: { webhook: "webhook_id", channel: "thread_id" },
  permissions: ["ManageWebhooks"],
  effect: "destructive",
  idempotent: false,
  output: messageResult,
  input: z.object({
    webhook_id: snowflake.describe("Snowflake ID of the webhook that sent the message"),
    message_id: snowflake.describe("Snowflake ID of the message to edit"),
    thread_id: snowflake
      .optional()
      .describe("Snowflake ID of the thread if the message is in a thread"),
    content: z.string().optional().describe("Updated message body text (up to 2000 characters)"),
    embeds: z
      .array(z.record(z.string(), z.unknown()))
      .optional()
      .describe("Replacement array of up to 10 rich embed objects"),
    allowed_mentions: webhookAllowedMentions,
    add_files: z
      .array(webhookFileUpload)
      .optional()
      .describe("New file attachments to upload and append to the message"),
    update_attachments: z
      .array(webhookAttachmentUpdate)
      .optional()
      .describe(
        "List of existing attachments to keep, rename, or re-describe (omit attachments to delete them)",
      ),
  }),
  execute: async (
    { webhook_id, message_id, thread_id, add_files, update_attachments, ...p },
    ctx,
  ) => {
    const token = await resolveWebhookToken(webhook_id, ctx.discord);
    const route = Routes.webhookMessage(webhook_id, token, message_id);
    const query = { thread_id };

    if (!add_files && !update_attachments) {
      return {
        message: await ctx.discord<RESTPatchAPIWebhookWithTokenMessageResult>({
          method: "PATCH",
          route,
          auth: false,
          query,
          body: p,
        }),
      };
    }

    const existing = await ctx.discord<RESTGetAPIWebhookWithTokenMessageResult>({
      method: "GET",
      route,
      auth: false,
      query,
    });
    const { files, attachments } = await ctx.files.merge(existing.attachments, {
      add: add_files,
      update: update_attachments,
    });
    return {
      message: await ctx.discord<RESTPatchAPIWebhookWithTokenMessageResult>({
        method: "PATCH",
        route,
        auth: false,
        query,
        body: { ...p, attachments },
        files,
      }),
    };
  },
});
