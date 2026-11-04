import { type RESTPostAPIChannelWebhookResult, Routes } from "discord-api-types/v10";
import { z } from "zod/v4";
import { defineTool } from "../../core/tool-registry.js";
import { dataUri, reason, snowflake } from "../schemas.js";
import { sanitizeWebhook, webhook } from "./schemas.js";

export const createWebhook = defineTool({
  name: "discord_create_webhook",
  description:
    "Create a new incoming webhook in a guild channel. The returned webhook contains an ID used by other webhook tools; webhook tools in this MCP server take webhook_id and never a token or webhook URL. Use discord_execute_webhook to send messages through the created webhook. Returns the sanitized webhook object.",
  operationIds: ["create_webhook"],
  toolset: "webhooks",
  scope: { channel: "channel_id" },
  permissions: ["ManageWebhooks"],
  effect: "write",
  idempotent: false,
  input: z.object({
    channel_id: snowflake.describe("Snowflake ID of the channel to create the webhook in"),
    name: z.string().min(1).max(80).describe("Name of the webhook (1-80 characters)"),
    avatar: dataUri
      .nullish()
      .describe(
        "Base64 image data URI for the default webhook avatar (image/png, image/jpeg, or image/gif)",
      ),
    reason: reason.describe("Reason for creating the webhook in the guild audit log"),
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
