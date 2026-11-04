import { type RESTGetAPIGuildVanityUrlResult, Routes } from "discord-api-types/v10";
import { z } from "zod/v4";
import { defineTool } from "../../core/tool-registry.js";
import { guildIds, vanityUrl } from "./schemas.js";

export const getGuildVanityUrl = defineTool({
  name: "discord_get_guild_vanity_url",
  description:
    "Retrieve the custom vanity URL invite code and usage statistics for a guild. Vanity URLs need a Community server with the VANITY_URL feature, usually unlocked by Server Boost Level 3. To inspect regular guild invites use discord_list_guild_invites. Returns the vanity code (null when none is set) and its use count.",
  operationIds: ["get_guild_vanity_url"],
  toolset: "guild",
  scope: { guild: "guild_id" },
  permissions: ["ManageGuild"],
  effect: "read",
  idempotent: true,
  input: z.object(guildIds),
  output: z.object({ vanity_url: vanityUrl }),
  execute: async ({ guild_id }, { discord }) => ({
    vanity_url: await discord<RESTGetAPIGuildVanityUrlResult>({
      method: "GET",
      route: Routes.guildVanityUrl(guild_id),
    }),
  }),
});
