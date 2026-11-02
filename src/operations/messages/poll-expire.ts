import { type RESTPostAPIPollExpireResult, Routes } from "discord-api-types/v10";
import { z } from "zod/v4";
import { defineTool } from "../../core/tool-registry.js";
import { message, snowflake } from "../schemas.js";

export const pollExpire = defineTool({
  name: "discord_poll_expire",
  description: "Immediately end a poll on a message",
  operationIds: ["poll_expire"],
  toolset: "messages",
  scope: { channel: "channel_id" },
  permissions: [],
  effect: "destructive",
  approval: false,
  idempotent: false,
  input: z.object({
    channel_id: snowflake,
    message_id: snowflake,
  }),
  output: z.object({
    message,
  }),
  execute: async (p, { discord }) => {
    const result = await discord<RESTPostAPIPollExpireResult>({
      method: "POST",
      route: Routes.expirePoll(p.channel_id, p.message_id),
    });
    return {
      message: result,
    };
  },
});
