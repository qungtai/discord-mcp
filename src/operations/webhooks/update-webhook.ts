import { type RESTPatchAPIWebhookResult, Routes } from "discord-api-types/v10";
import { z } from "zod/v4";
import { defineTool } from "../../core/tool-registry.js";
import { dataUri, reason, snowflake } from "../schemas.js";
import { sanitizeWebhook, webhook } from "./schemas.js";

export const updateWebhook = defineTool({
  name: "discord_update_webhook",
  description: "Update a webhook's name, avatar, or move it to a different channel",
  operationIds: ["update_webhook"],
  toolset: "webhooks",
  scope: { webhook: "webhook_id", channel: "channel_id" },
  permissions: ["ManageWebhooks"],
  effect: "destructive",
  idempotent: true,
  input: z.object({
    webhook_id: snowflake,
    name: z.string().min(1).max(80).optional().describe("Default name of the webhook"),
    avatar: dataUri.nullish().describe("Base64 image data URI for the default avatar"),
    channel_id: snowflake.optional().describe("Channel ID to move this webhook to"),
    reason,
  }),
  output: z.object({
    webhook,
  }),
  execute: async ({ webhook_id, reason: auditReason, ...body }, { discord }) => {
    const raw = await discord<RESTPatchAPIWebhookResult>({
      method: "PATCH",
      route: Routes.webhook(webhook_id),
      body,
      reason: auditReason,
    });
    return {
      webhook: sanitizeWebhook(raw),
    };
  },
});
