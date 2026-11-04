import { type RESTGetAPIGuildWebhooksResult, Routes } from "discord-api-types/v10";
import { z } from "zod/v4";
import { defineTool } from "../../core/tool-registry.js";
import { snowflake } from "../schemas.js";
import { sanitizeWebhook, webhook } from "./schemas.js";

export const listGuildWebhooks = defineTool({
  name: "discord_list_guild_webhooks",
  description:
    "List all webhooks configured across all channels in a guild. Webhook tools take webhook_id and never a token or webhook URL. Use discord_list_channel_webhooks to narrow results to a specific channel. Returns an array of sanitized webhook objects with tokens redacted.",
  operationIds: ["get_guild_webhooks"],
  toolset: "webhooks",
  scope: { guild: "guild_id" },
  permissions: ["ManageWebhooks"],
  effect: "read",
  idempotent: true,
  input: z.object({
    guild_id: snowflake.describe("Snowflake ID of the guild whose webhooks to list"),
  }),
  output: z.object({
    webhooks: z.array(webhook),
  }),
  execute: async ({ guild_id }, { discord }) => {
    const raw = await discord<RESTGetAPIGuildWebhooksResult>({
      method: "GET",
      route: Routes.guildWebhooks(guild_id),
    });
    return {
      webhooks: raw.map((item) => sanitizeWebhook(item)),
    };
  },
});
