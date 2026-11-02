import { type RESTGetAPIGuildVanityUrlResult, Routes } from "discord-api-types/v10";
import { z } from "zod/v4";
import { defineTool } from "../../core/tool-registry.js";
import { guildIds, vanityUrl } from "./guild-settings-schemas.js";

export const getGuildVanityUrl = defineTool({
  name: "discord_get_guild_vanity_url",
  description: "Get the vanity URL code for a guild",
  operationIds: ["get_guild_vanity_url"],
  toolset: "guild",
  scope: { guild: "guild_id" },
  permissions: ["ManageGuild"],
  effect: "read",
  idempotent: true,
  input: z.object(guildIds),
  output: z.object({ vanity_url: vanityUrl }),
  execute: async ({ guild_id }, { discord }) => ({
    vanity_url: (await discord<RESTGetAPIGuildVanityUrlResult>({
      method: "GET",
      route: Routes.guildVanityUrl(guild_id),
    })) as unknown as { [x: string]: unknown },
  }),
});
