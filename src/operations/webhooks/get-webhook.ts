import { type RESTGetAPIWebhookResult, Routes } from "discord-api-types/v10";
import { z } from "zod/v4";
import { defineTool } from "../../core/tool-registry.js";
import { snowflake } from "../schemas.js";
import { sanitizeWebhook, webhook } from "./schemas.js";

export const getWebhook = defineTool({
  name: "discord_get_webhook",
  description:
    "Fetch a webhook by its snowflake ID. Webhook tools take webhook_id and never a token or webhook URL, automatically resolving the required token internally. Use discord_list_channel_webhooks to find webhooks in a specific channel. Returns the sanitized webhook object with credentials redacted.",
  operationIds: ["get_webhook"],
  toolset: "webhooks",
  scope: { webhook: "webhook_id" },
  permissions: ["ManageWebhooks"],
  effect: "read",
  idempotent: true,
  input: z.object({
    webhook_id: snowflake.describe("Snowflake ID of the webhook to fetch"),
  }),
  output: z.object({
    webhook,
  }),
  execute: async ({ webhook_id }, { discord }) => {
    const raw = await discord<RESTGetAPIWebhookResult>({
      method: "GET",
      route: Routes.webhook(webhook_id),
    });
    return {
      webhook: sanitizeWebhook(raw),
    };
  },
});
