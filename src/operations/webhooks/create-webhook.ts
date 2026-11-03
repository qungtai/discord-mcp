import { type RESTPostAPIChannelWebhookResult, Routes } from "discord-api-types/v10";
import { z } from "zod/v4";
import { defineTool } from "../../core/tool-registry.js";
import { reason, snowflake } from "../schemas.js";
import { sanitizeWebhook, webhook } from "./schemas.js";

export const createWebhook = defineTool({
  name: "discord_create_webhook",
  description: "Create a new webhook in a channel",
  operationIds: ["create_webhook"],
  toolset: "webhooks",
  scope: { channel: "channel_id" },
  permissions: ["ManageWebhooks"],
  effect: "write",
  idempotent: false,
  input: z.object({
    channel_id: snowflake,
    name: z.string().min(1).max(80).describe("Name of the webhook (1-80 characters)"),
    avatar: z.string().nullish().describe("Base64 image data URI for the default avatar"),
    reason,
  }),
  output: z.object({
    webhook,
  }),
  execute: async ({ channel_id, reason: auditReason, ...body }, { discord }) => {
    const raw = await discord<RESTPostAPIChannelWebhookResult>({
      method: "POST",
      route: Routes.channelWebhooks(channel_id),
      body,
      reason: auditReason,
    });
    return {
      webhook: sanitizeWebhook(raw),
    };
  },
});
