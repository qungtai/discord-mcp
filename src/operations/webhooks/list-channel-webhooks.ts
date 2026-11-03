import { type RESTGetAPIChannelWebhooksResult, Routes } from "discord-api-types/v10";
import { z } from "zod/v4";
import { defineTool } from "../../core/tool-registry.js";
import { snowflake } from "../schemas.js";
import { sanitizeWebhook, webhook } from "./schemas.js";

export const listChannelWebhooks = defineTool({
  name: "discord_list_channel_webhooks",
  description: "List webhooks in a channel",
  operationIds: ["list_channel_webhooks"],
  toolset: "webhooks",
  scope: { channel: "channel_id" },
  permissions: ["ManageWebhooks"],
  effect: "read",
  idempotent: true,
  input: z.object({
    channel_id: snowflake,
  }),
  output: z.object({
    webhooks: z.array(webhook),
  }),
  execute: async ({ channel_id }, { discord }) => {
    const raw = await discord<RESTGetAPIChannelWebhooksResult>({
      method: "GET",
      route: Routes.channelWebhooks(channel_id),
    });
    return {
      webhooks: raw.map((item) => sanitizeWebhook(item as unknown as Record<string, unknown>)),
    };
  },
});
