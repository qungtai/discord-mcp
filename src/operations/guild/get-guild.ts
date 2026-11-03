import { type RESTGetAPIGuildResult, Routes } from "discord-api-types/v10";
import { z } from "zod/v4";
import { defineTool } from "../../core/tool-registry.js";
import { guild, guildIds } from "./guild-settings-schemas.js";

export const getGuild = defineTool({
  name: "discord_get_guild",
  description: "Get a guild by ID",
  operationIds: ["get_guild"],
  toolset: "guild",
  scope: { guild: "guild_id" },
  permissions: [],
  effect: "read",
  idempotent: true,
  input: z.object({
    ...guildIds,
    with_counts: z.boolean().optional().describe("Whether to include member and presence counts"),
  }),
  output: z.object({ guild }),
  execute: async ({ guild_id, with_counts }, { discord }) => ({
    guild: (await discord<RESTGetAPIGuildResult>({
      method: "GET",
      route: Routes.guild(guild_id),
      query: { with_counts },
    })) as unknown as { id: string },
  }),
});
