import { type RESTGetAPIGuildWebhooksResult, Routes } from "discord-api-types/v10";
import { z } from "zod/v4";
import { defineTool } from "../../core/tool-registry.js";
import { snowflake } from "../schemas.js";
import { sanitizeWebhook, webhook } from "./schemas.js";

export const listGuildWebhooks = defineTool({
  name: "discord_list_guild_webhooks",
  description: "List webhooks in a guild",
  operationIds: ["get_guild_webhooks"],
  toolset: "webhooks",
  scope: { guild: "guild_id" },
  permissions: ["ManageWebhooks"],
  effect: "read",
  idempotent: true,
  input: z.object({
    guild_id: snowflake,
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
