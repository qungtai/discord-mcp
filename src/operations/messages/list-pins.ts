import { type RESTGetAPIChannelPinsResult, Routes } from "discord-api-types/v10";
import { z } from "zod/v4";
import { defineTool } from "../../core/tool-registry.js";
import { message, snowflake } from "../schemas.js";

export const listPins = defineTool({
  name: "discord_list_pins",
  description: "List pinned messages in a channel",
  operationIds: ["list_pins", "deprecated_list_pins"],
  toolset: "messages",
  scope: { channel: "channel_id" },
  permissions: ["ViewChannel", "ReadMessageHistory"],
  effect: "read",
  idempotent: true,
  output: z.object({
    messages: z.array(message),
  }),
  input: z.object({
    channel_id: snowflake,
  }),
  execute: async ({ channel_id }, { discord }) => ({
    messages: await discord<RESTGetAPIChannelPinsResult>({
      method: "GET",
      route: Routes.channelPins(channel_id),
    }),
  }),
});
