import { type RESTPostAPIWebhookWithTokenWaitResult, Routes } from "discord-api-types/v10";
import { z } from "zod/v4";
import { defineTool } from "../../core/tool-registry.js";
import { messageResult } from "../messages/schemas.js";
import { messageFlags, snowflake } from "../schemas.js";
import {
  resolveWebhookToken,
  webhookAllowedMentions,
  webhookFileUpload,
  webhookPoll,
} from "./schemas.js";

export const executeWebhook = defineTool({
  name: "discord_execute_webhook",
  description:
    "Post a message through an incoming webhook, with optional embeds, files, a poll and a custom username or avatar. Webhook tools take webhook_id and never a token or webhook URL. Send at least one of content, embeds, files or poll. Use thread_id to post into an existing thread, or thread_name to open a new post in a forum or media channel. To change a sent message use discord_edit_webhook_message. Returns the created message.",
  operationIds: ["execute_webhook"],
  toolset: "webhooks",
  scope: { webhook: "webhook_id", channel: "thread_id" },
  permissions: ["ManageWebhooks"],
  effect: "write",
  // It can post under any name and avatar through webhooks other integrations own.
  approval: true,
  idempotent: false,
  output: messageResult,
  input: z.object({
    webhook_id: snowflake.describe("Snowflake ID of the incoming webhook to execute"),
    content: z.string().optional().describe("Message body text (up to 2000 characters)"),
    embeds: z
      .array(z.record(z.string(), z.unknown()))
      .optional()
      .describe("Up to 10 rich embed objects to include in the message"),
    allowed_mentions: webhookAllowedMentions,
    username: z
      .string()
      .optional()
      .describe("Override default username of the webhook (1-80 characters)"),
    avatar_url: z.string().optional().describe("Override default avatar URL of the webhook"),
    tts: z
      .boolean()
      .optional()
      .describe("Whether this message should be spoken using text-to-speech"),
    files: z
      .array(webhookFileUpload)
      .default([])
      .describe("Local file attachments to upload with the webhook message"),
    poll: webhookPoll.optional(),
    flags: messageFlags.describe(
      "Message flags bitfield (4 for SUPPRESS_EMBEDS, 4096 for SUPPRESS_NOTIFICATIONS)",
    ),
    thread_id: snowflake
      .optional()
      .describe("Snowflake ID of an existing thread in the webhook channel to post into"),
    thread_name: z
      .string()
      .optional()
      .describe(
        "Name of a new thread to create when executing the webhook in a forum or media channel",
      ),
    applied_tags: z
      .array(snowflake)
      .max(5)
      .optional()
      .describe("Array of up to 5 tag snowflake IDs to apply to the newly created forum thread"),
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
