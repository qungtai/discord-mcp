import { Routes } from "discord-api-types/v10";
import { z } from "zod/v4";
import type { DiscordRequest } from "../../core/ports.js";
import { PToolError } from "../../core/tool-error.js";
import { resource, snowflake, user } from "../schemas.js";

export const webhook = resource(
  z.looseObject({
    id: snowflake,
    type: z.number().optional(),
    guild_id: snowflake.nullish(),
    channel_id: snowflake.nullish(),
    user: user.optional(),
    name: z.string().nullish(),
    avatar: z.string().nullish(),
    application_id: snowflake.nullish(),
    source_guild: z.unknown().optional(),
    source_channel: z.unknown().optional(),
  }),
);

export const sanitizeWebhook = <T extends object>(raw: T): Omit<T, "token" | "url"> => {
  const { token: _token, url: _url, ...rest } = raw as Record<string, unknown>;
  return rest as Omit<T, "token" | "url">;
};

export const resolveWebhookToken = async (
  webhookId: string,
  discord: DiscordRequest,
): Promise<string> => {
  const data = await discord<{ token?: string | null }>({
    method: "GET",
    route: Routes.webhook(webhookId),
  });
  if (!data.token) {
    throw new PToolError("Webhook has no token", {
      category: "validation",
      retryable: false,
      remediation: "Only incoming webhooks can post; create one with discord_create_webhook",
    });
  }
  return data.token;
};
