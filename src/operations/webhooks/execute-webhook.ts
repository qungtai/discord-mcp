import {
  MessageFlags,
  type RESTPostAPIWebhookWithTokenWaitResult,
  Routes,
} from "discord-api-types/v10";
import { z } from "zod/v4";
import { defineTool } from "../../core/tool-registry.js";
import { messageBody, messageResult, poll } from "../messages/schemas.js";
import { fileUpload, snowflake } from "../schemas.js";
import { resolveWebhookToken } from "./schemas.js";

export const executeWebhook = defineTool({
  name: "discord_execute_webhook",
  description: "Execute a webhook to send a message",
  operationIds: ["execute_webhook"],
  toolset: "webhooks",
  scope: { webhook: "webhook_id", channel: "thread_id" },
  permissions: ["ManageWebhooks"],
  effect: "write",
  idempotent: false,
  output: messageResult,
  input: z.object({
    webhook_id: snowflake,
    ...messageBody,
    username: z.string().optional().describe("Override default username of the webhook"),
    avatar_url: z.string().optional().describe("Override default avatar URL of the webhook"),
    tts: z.boolean().optional(),
    files: z.array(fileUpload).default([]),
    poll: poll.optional(),
    flags: z
      .number()
      .int()
      .min(0)
      .refine(
        (flags) =>
          (flags & ~(MessageFlags.SuppressEmbeds | MessageFlags.SuppressNotifications)) === 0,
        {
          message: "Only SUPPRESS_EMBEDS (4) and SUPPRESS_NOTIFICATIONS (4096) are supported",
        },
      )
      .optional()
      .describe("Message flags bitfield"),
    thread_id: snowflake.optional().describe("Send message to a thread within the webhook channel"),
    thread_name: z.string().optional().describe("Name of thread to create in a forum channel"),
    applied_tags: z
      .array(snowflake)
      .max(5)
      .optional()
      .describe("Array of tag IDs for the forum thread"),
  }),
  execute: async ({ webhook_id, thread_id, files: uploads, ...p }, { discord, files }) => {
    const token = await resolveWebhookToken(webhook_id, discord);
    const { files: raw, attachments } = await files.prepare(uploads);
    return {
      message: await discord<RESTPostAPIWebhookWithTokenWaitResult>({
        method: "POST",
        route: Routes.webhook(webhook_id, token),
        auth: false,
        query: {
          wait: true,
          thread_id,
        },
        body: {
          ...p,
          attachments,
        },
        files: raw,
      }),
    };
  },
});
