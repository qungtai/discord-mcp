import { type RESTGetAPIGuildChannelsResult, Routes } from "discord-api-types/v10";
import { z } from "zod/v4";
import { defineTool } from "../../core/tool-registry.js";
import { channel, snowflake } from "../schemas.js";

export const listGuildChannels = defineTool({
  name: "discord_list_guild_channels",
  description:
    "List all channels, categories, voice channels and forum channels in a guild. Does not include active or archived threads; use discord_list_public_archived_threads or discord_list_private_archived_threads for threads. Returns an array of Channel objects ordered by category and position.",
  operationIds: ["list_guild_channels"],
  toolset: "channels",
  scope: { guild: "guild_id" },
  permissions: [],
  effect: "read",
  idempotent: true,
  input: z.object({
    guild_id: snowflake.describe("Snowflake ID of the guild whose channels to list"),
  }),
  output: z.object({ channels: z.array(channel) }),
  execute: async ({ guild_id }, { discord }) => ({
    channels: await discord<RESTGetAPIGuildChannelsResult>({
      method: "GET",
      route: Routes.guildChannels(guild_id),
    }),
  }),
});
