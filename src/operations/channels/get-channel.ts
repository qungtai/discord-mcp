import { type RESTGetAPIChannelResult, Routes } from "discord-api-types/v10";
import { z } from "zod/v4";
import { defineTool } from "../../core/tool-registry.js";
import { snowflake } from "../schemas.js";
import { channelResult } from "./schemas.js";

export const getChannel = defineTool({
  name: "discord_get_channel",
  description: "Get a channel by ID",
  operationIds: ["get_channel"],
  toolset: "channels",
  scope: { channel: "channel_id" },
  permissions: ["ViewChannel"],
  effect: "read",
  idempotent: true,
  input: z.object({ channel_id: snowflake }),
  output: channelResult,
  execute: async (p, { discord }) => ({
    channel: await discord<RESTGetAPIChannelResult>({
      method: "GET",
      route: Routes.channel(p.channel_id),
    }),
  }),
});
