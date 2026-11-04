import { type RESTGetAPIChannelInvitesResult, Routes } from "discord-api-types/v10";
import { z } from "zod/v4";
import { defineTool } from "../../core/tool-registry.js";
import { snowflake } from "../schemas.js";
import { invite } from "./schemas.js";

export const listChannelInvites = defineTool({
  name: "discord_list_channel_invites",
  description:
    "List all active invite codes for a specific guild channel, including usage statistics and expiration timestamps. Use discord_list_guild_invites to view all active invites across the entire guild. Returns an array of invite objects with inviter and use counts.",
  operationIds: ["list_channel_invites"],
  toolset: "invites",
  scope: { channel: "channel_id" },
  permissions: ["ManageChannels"],
  effect: "read",
  idempotent: true,
  input: z.object({
    channel_id: snowflake.describe("Snowflake ID of the channel whose active invites to list"),
  }),
  output: z.object({
    invites: z.array(invite),
  }),
  execute: async ({ channel_id }, { discord }) => ({
    invites: await discord<RESTGetAPIChannelInvitesResult>({
      method: "GET",
      route: Routes.channelInvites(channel_id),
    }),
  }),
});
