import { type RESTDeleteAPIChannelResult, Routes } from "discord-api-types/v10";
import { z } from "zod/v4";
import { defineTool } from "../../core/tool-registry.js";
import { reason, snowflake } from "../schemas.js";
import { channelResult } from "./ch-channels-schemas.js";

export const deleteChannel = defineTool({
  name: "discord_delete_channel",
  description: "Delete a channel, or close a private message",
  operationIds: ["delete_channel"],
  toolset: "channels",
  scope: { channel: "channel_id" },
  permissions: ["ManageChannels"],
  effect: "destructive",
  idempotent: true,
  input: z.object({
    channel_id: snowflake,
    reason,
  }),
  output: channelResult,
  execute: async ({ channel_id, reason }, { discord }) => ({
    channel: await discord<RESTDeleteAPIChannelResult>({
      method: "DELETE",
      route: Routes.channel(channel_id),
      reason,
    }),
  }),
});
