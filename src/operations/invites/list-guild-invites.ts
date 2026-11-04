import { type RESTGetAPIGuildInvitesResult, Routes } from "discord-api-types/v10";
import { z } from "zod/v4";
import { defineTool } from "../../core/tool-registry.js";
import { snowflake } from "../schemas.js";
import { invite } from "./schemas.js";

export const listGuildInvites = defineTool({
  name: "discord_list_guild_invites",
  description:
    "List all active invite codes across all channels in a guild, including inviter details and usage counts. Use discord_list_channel_invites to restrict results to a single channel. Returns an array of invite objects.",
  operationIds: ["list_guild_invites"],
  toolset: "invites",
  scope: { guild: "guild_id" },
  permissions: ["ManageGuild"],
  effect: "read",
  idempotent: true,
  input: z.object({
    guild_id: snowflake.describe("Snowflake ID of the guild whose active invites to list"),
  }),
  output: z.object({
    invites: z.array(invite),
  }),
  execute: async ({ guild_id }, { discord }) => ({
    invites: await discord<RESTGetAPIGuildInvitesResult>({
      method: "GET",
      route: Routes.guildInvites(guild_id),
    }),
  }),
});
