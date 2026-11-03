import {
  type RESTGetAPIWebhookWithTokenMessageResult,
  type RESTPatchAPIWebhookWithTokenMessageResult,
  Routes,
} from "discord-api-types/v10";
import { z } from "zod/v4";
import { defineTool } from "../../core/tool-registry.js";
import { messageBody, messageResult } from "../messages/schemas.js";
import { attachmentUpdate, fileUpload, snowflake } from "../schemas.js";
import { resolveWebhookToken } from "./schemas.js";

export const editWebhookMessage = defineTool({
  name: "discord_edit_webhook_message",
  description: "Edit a message previously sent by a webhook",
  operationIds: ["get_webhook_message", "update_webhook_message"],
  toolset: "webhooks",
  scope: { webhook: "webhook_id", channel: "thread_id" },
  permissions: ["ManageWebhooks"],
  effect: "destructive",
  idempotent: false,
  output: messageResult,
  input: z.object({
    webhook_id: snowflake,
    message_id: snowflake,
    thread_id: snowflake.optional().describe("Thread ID if the message is in a thread"),
    ...messageBody,
    add_files: z.array(fileUpload).optional(),
    update_attachments: z.array(attachmentUpdate).optional(),
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
