import { type RESTGetAPIChannelResult, Routes } from "discord-api-types/v10";
import { z } from "zod/v4";
import { defineTool } from "../../core/tool-registry.js";
import { snowflake } from "../schemas.js";
import { channelResult } from "./schemas.js";

export const getChannel = defineTool({
  name: "discord_get_channel",
  description:
    "Fetch details for a guild channel, category, thread or direct message channel by its snowflake ID. Use discord_list_guild_channels to list all channels in a guild, or discord_get_thread_member to inspect thread participants. Returns a Channel object containing metadata such as type, topic, permissions overwrites and position.",
  operationIds: ["get_channel"],
  toolset: "channels",
  scope: { channel: "channel_id" },
  permissions: ["ViewChannel"],
  effect: "read",
  idempotent: true,
  input: z.object({
    channel_id: snowflake.describe("Snowflake ID of the channel, category, thread or DM to fetch"),
  }),
  output: channelResult,
  execute: async (p, { discord }) => ({
    channel: await discord<RESTGetAPIChannelResult>({
      method: "GET",
      route: Routes.channel(p.channel_id),
    }),
  }),
});
