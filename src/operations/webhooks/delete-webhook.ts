import { Routes } from "discord-api-types/v10";
import { z } from "zod/v4";
import { defineTool } from "../../core/tool-registry.js";
import { reason, snowflake } from "../schemas.js";

export const deleteWebhook = defineTool({
  name: "discord_delete_webhook",
  description:
    "Permanently delete a webhook by its snowflake ID. Webhook tools take webhook_id and never a token or webhook URL. Deletion cannot be undone; use discord_create_webhook to create a replacement webhook. Returns the deleted status and webhook ID.",
  operationIds: ["delete_webhook"],
  toolset: "webhooks",
  scope: { webhook: "webhook_id" },
  permissions: ["ManageWebhooks"],
  effect: "destructive",
  idempotent: true,
  input: z.object({
    webhook_id: snowflake.describe("Snowflake ID of the webhook to delete permanently"),
    reason: reason.describe("Reason for deleting the webhook in the guild audit log"),
  }),
  output: z.object({
    deleted: z.literal(true),
    webhook_id: snowflake,
  }),
  execute: async ({ webhook_id, reason: auditReason }, { discord }) => {
    await discord<void>({
      method: "DELETE",
      route: Routes.webhook(webhook_id),
      reason: auditReason,
    });
    return {
      deleted: true as const,
      webhook_id,
    };
  },
});
