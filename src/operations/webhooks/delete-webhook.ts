import { Routes } from "discord-api-types/v10";
import { z } from "zod/v4";
import { defineTool } from "../../core/tool-registry.js";
import { reason, snowflake } from "../schemas.js";

export const deleteWebhook = defineTool({
  name: "discord_delete_webhook",
  description: "Delete a webhook permanently",
  operationIds: ["delete_webhook"],
  toolset: "webhooks",
  scope: { webhook: "webhook_id" },
  permissions: ["ManageWebhooks"],
  effect: "destructive",
  idempotent: true,
  input: z.object({
    webhook_id: snowflake,
    reason,
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
