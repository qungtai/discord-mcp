import { type RESTGetAPIWebhookResult, Routes } from "discord-api-types/v10";
import { z } from "zod/v4";
import { defineTool } from "../../core/tool-registry.js";
import { snowflake } from "../schemas.js";
import { sanitizeWebhook, webhook } from "./schemas.js";

export const getWebhook = defineTool({
  name: "discord_get_webhook",
  description: "Get a webhook by ID",
  operationIds: ["get_webhook"],
  toolset: "webhooks",
  scope: { webhook: "webhook_id" },
  permissions: ["ManageWebhooks"],
  effect: "read",
  idempotent: true,
  input: z.object({
    webhook_id: snowflake,
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
