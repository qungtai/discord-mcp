import { type RESTGetAPIGuildResult, Routes } from "discord-api-types/v10";
import { z } from "zod/v4";
import { defineTool } from "../../core/tool-registry.js";
import { guild, guildIds } from "./schemas.js";

export const getGuild = defineTool({
  name: "discord_get_guild",
  description:
    "Fetch detailed information for a guild by ID that the bot currently belongs to. To view basic discoverable information without bot membership use discord_get_guild_preview, and to list all guilds the bot belongs to use discord_list_my_guilds. Returns the full guild object including owner ID, features, verification level, and optional counts.",
  operationIds: ["get_guild"],
  toolset: "guild",
  scope: { guild: "guild_id" },
  permissions: [],
  effect: "read",
  idempotent: true,
  input: z.object({
    ...guildIds,
    with_counts: z
      .boolean()
      .optional()
      .describe(
        "Whether to include approximate_member_count and approximate_presence_count in the response (defaults to false)",
      ),
  }),
  output: z.object({ guild }),
  execute: async ({ guild_id, with_counts }, { discord }) => ({
    guild: await discord<RESTGetAPIGuildResult>({
      method: "GET",
      route: Routes.guild(guild_id),
      query: { with_counts },
    }),
  }),
});
