import { type RESTGetAPIGuildChannelsResult, Routes } from "discord-api-types/v10";
import { z } from "zod/v4";
import { defineTool } from "../../core/tool-registry.js";
import { channel, snowflake } from "../schemas.js";

export const listGuildChannels = defineTool({
  name: "discord_list_guild_channels",
  description: "List channels in a guild",
  operationIds: ["list_guild_channels"],
  toolset: "channels",
  scope: { guild: "guild_id" },
  permissions: [],
  effect: "read",
  idempotent: true,
  input: z.object({ guild_id: snowflake }),
  output: z.object({ channels: z.array(channel) }),
  execute: async ({ guild_id }, { discord }) => ({
    channels: await discord<RESTGetAPIGuildChannelsResult>({
      method: "GET",
      route: Routes.guildChannels(guild_id),
    }),
  }),
});
